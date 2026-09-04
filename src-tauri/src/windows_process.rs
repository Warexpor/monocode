//! Toolhelp snapshots plus PEB / `NtQueryInformationProcess` reads.
//! Unix analog: `/proc` or `ps` for argv, environ, and `kill(pid, 0)`.

use std::os::windows::io::{FromRawHandle, OwnedHandle, RawHandle};

use windows_sys::Win32::Foundation::{GetLastError, HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::Diagnostics::Debug::ReadProcessMemory;
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    GetExitCodeProcess, OpenProcess, TerminateProcess, PROCESS_QUERY_INFORMATION,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, PROCESS_VM_READ,
};

const PROCESS_BASIC_INFORMATION: u32 = 0;
const PROCESS_COMMAND_LINE_INFORMATION: u32 = 60;
const PEB_PROCESS_PARAMETERS_OFFSET: usize = 0x20;
const PROCESS_PARAMETERS_COMMAND_LINE_OFFSET: usize = 0x70;
const PROCESS_PARAMETERS_ENVIRONMENT_OFFSET: usize = 0x80;
const CMDLINE_UTF16_CAP: usize = 32 * 1024;
const ENV_READ_CAP: usize = 64 * 1024;
const STILL_ACTIVE: u32 = 259;
const ERROR_ACCESS_DENIED: u32 = 5;

#[repr(C)]
#[derive(Clone, Copy)]
struct ProcessBasicInformation {
    exit_status: isize,
    peb_base_address: *mut core::ffi::c_void,
    affinity_mask: usize,
    base_priority: i32,
    unique_process_id: usize,
    inherited_from_unique_process_id: usize,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct UnicodeString {
    length: u16,
    maximum_length: u16,
    buffer: *const u16,
}

#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(
        process_handle: HANDLE,
        process_information_class: u32,
        process_information: *mut core::ffi::c_void,
        process_information_length: u32,
        return_length: *mut u32,
    ) -> i32;
}

pub(crate) fn alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() || process == INVALID_HANDLE_VALUE {
            return GetLastError() == ERROR_ACCESS_DENIED;
        }
        let _owned = OwnedHandle::from_raw_handle(process as RawHandle);
        let mut code = 0u32;
        if GetExitCodeProcess(process, &mut code) == 0 {
            return true;
        }
        code == STILL_ACTIVE
    }
}

/// pid, parent pid, executable file name.
pub(crate) fn snapshot() -> Vec<(u32, u32, String)> {
    unsafe {
        let raw = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if raw.is_null() || raw == INVALID_HANDLE_VALUE {
            return Vec::new();
        }
        let _snap = OwnedHandle::from_raw_handle(raw as RawHandle);
        let mut entry = std::mem::zeroed::<PROCESSENTRY32W>();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(raw, &mut entry) == 0 {
            return Vec::new();
        }
        let mut rows = Vec::new();
        loop {
            let name = wide_z_to_string(&entry.szExeFile);
            if !name.is_empty() {
                rows.push((entry.th32ProcessID, entry.th32ParentProcessID, name));
            }
            if Process32NextW(raw, &mut entry) == 0 {
                break;
            }
        }
        rows
    }
}

pub(crate) fn terminate(pid: u32) {
    if pid == 0 {
        return;
    }
    unsafe {
        let process = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if process.is_null() || process == INVALID_HANDLE_VALUE {
            return;
        }
        let _owned = OwnedHandle::from_raw_handle(process as RawHandle);
        let _ = TerminateProcess(process, 1);
    }
}

/// Full command line when the kernel will give it; otherwise `None`.
///
/// Unix analog: `ps -o args=`. `ProcessCommandLineInformation` sometimes
/// returns a `UNICODE_STRING` whose buffer still lives in the target
/// process — `ReadProcessMemory` that, then fall back to the PEB
/// `CommandLine` field (same path as `/proc/pid/cmdline`).
pub(crate) fn command_line(pid: u32) -> Option<String> {
    if pid == 0 {
        return None;
    }
    unsafe {
        let mut process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if process.is_null() || process == INVALID_HANDLE_VALUE {
            process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, 0, pid);
        }
        if process.is_null() || process == INVALID_HANDLE_VALUE {
            return None;
        }
        let _owned = OwnedHandle::from_raw_handle(process as RawHandle);
        command_line_via_ntquery(process).or_else(|| peb_command_line(process))
    }
}

fn command_line_via_ntquery(process: HANDLE) -> Option<String> {
    unsafe {
        let mut needed = 0u32;
        NtQueryInformationProcess(
            process,
            PROCESS_COMMAND_LINE_INFORMATION,
            core::ptr::null_mut(),
            0,
            &mut needed,
        );
        if needed < std::mem::size_of::<UnicodeString>() as u32 {
            return None;
        }
        let mut buf = vec![0u8; needed as usize];
        let status = NtQueryInformationProcess(
            process,
            PROCESS_COMMAND_LINE_INFORMATION,
            buf.as_mut_ptr() as *mut core::ffi::c_void,
            needed,
            &mut needed,
        );
        if status < 0 || (needed as usize) < std::mem::size_of::<UnicodeString>() {
            return None;
        }
        let info = &*(buf.as_ptr() as *const UnicodeString);
        unicode_string_text(process, info, &buf)
    }
}

fn peb_command_line(process: HANDLE) -> Option<String> {
    if !cfg!(target_pointer_width = "64") {
        return None;
    }
    unsafe {
        let mut pbi = std::mem::zeroed::<ProcessBasicInformation>();
        let mut got = 0u32;
        let status = NtQueryInformationProcess(
            process,
            PROCESS_BASIC_INFORMATION,
            &mut pbi as *mut _ as *mut core::ffi::c_void,
            std::mem::size_of::<ProcessBasicInformation>() as u32,
            &mut got,
        );
        if status < 0 || pbi.peb_base_address.is_null() {
            return None;
        }
        let mut params = 0usize;
        if !read_remote(
            process,
            (pbi.peb_base_address as usize + PEB_PROCESS_PARAMETERS_OFFSET) as *const usize,
            &mut params,
        ) || params == 0
        {
            return None;
        }
        let mut cmdline = std::mem::zeroed::<UnicodeString>();
        if !read_remote(
            process,
            (params + PROCESS_PARAMETERS_COMMAND_LINE_OFFSET) as *const UnicodeString,
            &mut cmdline,
        ) {
            return None;
        }
        unicode_string_text(process, &cmdline, &[])
    }
}

fn unicode_string_text(process: HANDLE, info: &UnicodeString, local: &[u8]) -> Option<String> {
    let length = info.length as usize / 2;
    if length == 0 || length > CMDLINE_UTF16_CAP || info.buffer.is_null() {
        return None;
    }
    if !local.is_empty() {
        let start = local.as_ptr();
        let end = unsafe { start.add(local.len()) };
        let wide = info.buffer as *const u8;
        let wide_end = unsafe { wide.add(length.saturating_mul(2)) };
        if wide >= start && wide_end <= end {
            let units = unsafe { std::slice::from_raw_parts(info.buffer, length) };
            return utf16_cmdline(units);
        }
    }
    read_remote_utf16(process, info.buffer, length)
}

fn read_remote_utf16(process: HANDLE, address: *const u16, length: usize) -> Option<String> {
    if address.is_null() || length == 0 || length > CMDLINE_UTF16_CAP {
        return None;
    }
    let mut remote = vec![0u16; length];
    let mut bytes_read = 0usize;
    unsafe {
        if ReadProcessMemory(
            process,
            address as *const core::ffi::c_void,
            remote.as_mut_ptr() as *mut core::ffi::c_void,
            length * 2,
            &mut bytes_read,
        ) == 0
            || bytes_read < 2
        {
            return None;
        }
    }
    remote.truncate(bytes_read / 2);
    utf16_cmdline(&remote)
}

fn utf16_cmdline(units: &[u16]) -> Option<String> {
    let text = String::from_utf16_lossy(units);
    let trimmed = text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// UTF-8 environment block with NUL separators, like `/proc/pid/environ`.
pub(crate) fn environment_block(pid: u32) -> Option<Vec<u8>> {
    if pid == 0 || !cfg!(target_pointer_width = "64") {
        return None;
    }
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if process.is_null() || process == INVALID_HANDLE_VALUE {
            return None;
        }
        let _owned = OwnedHandle::from_raw_handle(process as RawHandle);
        let mut pbi = std::mem::zeroed::<ProcessBasicInformation>();
        let mut got = 0u32;
        let status = NtQueryInformationProcess(
            process,
            PROCESS_BASIC_INFORMATION,
            &mut pbi as *mut _ as *mut core::ffi::c_void,
            std::mem::size_of::<ProcessBasicInformation>() as u32,
            &mut got,
        );
        if status < 0 || pbi.peb_base_address.is_null() {
            return None;
        }
        let mut params = 0usize;
        if !read_remote(
            process,
            (pbi.peb_base_address as usize + PEB_PROCESS_PARAMETERS_OFFSET) as *const usize,
            &mut params,
        ) || params == 0
        {
            return None;
        }
        let mut env_ptr = 0usize;
        if !read_remote(
            process,
            (params + PROCESS_PARAMETERS_ENVIRONMENT_OFFSET) as *const usize,
            &mut env_ptr,
        ) || env_ptr == 0
        {
            return None;
        }
        let mut wide = vec![0u16; ENV_READ_CAP / 2];
        let mut bytes_read = 0usize;
        if ReadProcessMemory(
            process,
            env_ptr as *const core::ffi::c_void,
            wide.as_mut_ptr() as *mut core::ffi::c_void,
            wide.len() * 2,
            &mut bytes_read,
        ) == 0
            || bytes_read < 4
        {
            return None;
        }
        wide.truncate(bytes_read / 2);
        Some(utf16_env_to_utf8(&wide))
    }
}

pub(crate) fn utf16_env_to_utf8(wide: &[u16]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut i = 0;
    while i + 1 < wide.len() {
        if wide[i] == 0 && wide[i + 1] == 0 {
            break;
        }
        let start = i;
        while i < wide.len() && wide[i] != 0 {
            i += 1;
        }
        out.extend(String::from_utf16_lossy(&wide[start..i]).as_bytes());
        out.push(0);
        i += 1;
    }
    out
}

fn read_remote<T: Copy>(process: HANDLE, address: *const T, out: &mut T) -> bool {
    let mut bytes_read = 0usize;
    unsafe {
        ReadProcessMemory(
            process,
            address as *const core::ffi::c_void,
            out as *mut T as *mut core::ffi::c_void,
            std::mem::size_of::<T>(),
            &mut bytes_read,
        ) != 0
            && bytes_read == std::mem::size_of::<T>()
    }
}

fn wide_z_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&unit| unit == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_cmdline_trims_and_rejects_empty() {
        let units: Vec<u16> = "  cargo build --release  ".encode_utf16().collect();
        assert_eq!(
            utf16_cmdline(&units).as_deref(),
            Some("cargo build --release")
        );
        assert_eq!(utf16_cmdline(&[]), None);
        assert_eq!(utf16_cmdline(&[32, 32]), None);
    }

    #[test]
    fn command_line_reads_this_process() {
        let line = command_line(std::process::id()).expect("self command line");
        assert!(!line.trim().is_empty(), "empty self argv");
    }
}
