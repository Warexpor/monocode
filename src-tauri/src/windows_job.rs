//! Per-child Job Object with kill-on-close. Unix process groups have no Windows
//! twin; this is what keeps harness trees from surviving MonoCode exit.

use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle, RawHandle};
use std::process::Child;

type HANDLE = *mut core::ffi::c_void;
const INVALID_HANDLE_VALUE: HANDLE = -1isize as HANDLE;
const PROCESS_TERMINATE: u32 = 0x0001;
const PROCESS_SET_QUOTA: u32 = 0x0100;
const PROCESS_ASSIGN_PROCESS_TO_JOB_OBJECT: u32 = 0x2000;
const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: u32 = 9;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x0000_2000;

#[repr(C)]
struct JobObjectBasicLimitInformation {
    per_process_user_time_limit: i64,
    per_job_user_time_limit: i64,
    limit_flags: u32,
    minimum_working_set_size: usize,
    maximum_working_set_size: usize,
    active_process_limit: u32,
    affinity: usize,
    priority_class: u32,
    scheduling_class: u32,
}

#[repr(C)]
struct IoCounters {
    read_operation_count: u64,
    write_operation_count: u64,
    other_operation_count: u64,
    read_transfer_count: u64,
    write_transfer_count: u64,
    other_transfer_count: u64,
}

#[repr(C)]
struct JobObjectExtendedLimitInformation {
    basic_limit_information: JobObjectBasicLimitInformation,
    io_info: IoCounters,
    process_memory_limit: usize,
    job_memory_limit: usize,
    peak_process_memory_used: usize,
    peak_job_memory_used: usize,
}

#[link(name = "kernel32")]
unsafe extern "system" {
    fn CreateJobObjectW(attributes: *const core::ffi::c_void, name: *const u16) -> HANDLE;
    fn SetInformationJobObject(
        job: HANDLE,
        info_class: u32,
        info: *const core::ffi::c_void,
        length: u32,
    ) -> i32;
    fn AssignProcessToJobObject(job: HANDLE, process: HANDLE) -> i32;
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> HANDLE;
    fn CloseHandle(handle: HANDLE) -> i32;
}

pub struct Job {
    handle: OwnedHandle,
}

impl Job {
    pub fn new() -> Option<Self> {
        unsafe {
            let handle = CreateJobObjectW(core::ptr::null(), core::ptr::null());
            if handle.is_null() || handle == INVALID_HANDLE_VALUE {
                return None;
            }
            let handle = OwnedHandle::from_raw_handle(handle as RawHandle);
            let mut info = JobObjectExtendedLimitInformation {
                basic_limit_information: JobObjectBasicLimitInformation {
                    per_process_user_time_limit: 0,
                    per_job_user_time_limit: 0,
                    limit_flags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                    minimum_working_set_size: 0,
                    maximum_working_set_size: 0,
                    active_process_limit: 0,
                    affinity: 0,
                    priority_class: 0,
                    scheduling_class: 0,
                },
                io_info: IoCounters {
                    read_operation_count: 0,
                    write_operation_count: 0,
                    other_operation_count: 0,
                    read_transfer_count: 0,
                    write_transfer_count: 0,
                    other_transfer_count: 0,
                },
                process_memory_limit: 0,
                job_memory_limit: 0,
                peak_process_memory_used: 0,
                peak_job_memory_used: 0,
            };
            let ok = SetInformationJobObject(
                handle.as_raw_handle() as HANDLE,
                JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                &info as *const _ as *const core::ffi::c_void,
                std::mem::size_of_val(&info) as u32,
            );
            if ok == 0 {
                return None;
            }
            Some(Self { handle })
        }
    }

    pub fn assign_pid(&self, pid: u32) -> bool {
        if pid == 0 {
            return false;
        }
        unsafe {
            let process = OpenProcess(
                PROCESS_ASSIGN_PROCESS_TO_JOB_OBJECT | PROCESS_TERMINATE | PROCESS_SET_QUOTA,
                0,
                pid,
            );
            if process.is_null() || process == INVALID_HANDLE_VALUE {
                return false;
            }
            let ok = AssignProcessToJobObject(self.handle.as_raw_handle() as HANDLE, process);
            CloseHandle(process);
            ok != 0
        }
    }

    pub fn assign_child(&self, child: &Child) -> bool {
        self.assign_pid(child.id())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    #[test]
    fn job_assigns_and_drops_without_panic() {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut child = Command::new("powershell.exe")
            .args(["-NoLogo", "-Command", "Start-Sleep -Seconds 30"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn sleep");
        let pid = child.id();
        let job = Job::new().expect("create job");
        assert!(job.assign_pid(pid));
        drop(job);
        let _ = child.try_wait();
        let mut still = Command::new("tasklist");
        still.args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"]);
        let output = still.output().expect("tasklist");
        let listed = String::from_utf8_lossy(&output.stdout).contains(&format!(",\"{pid}\","));
        assert!(!listed, "kill-on-close should reap the sleeper");
        let _ = child.kill();
        let _ = child.wait();
    }
}
