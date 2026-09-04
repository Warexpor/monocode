use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle, RawHandle};
use std::process::Child;

use windows_sys::Win32::Foundation::{HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

pub struct Job {
    _handle: OwnedHandle,
}

impl Job {
    fn create() -> Option<Self> {
        unsafe {
            let raw = CreateJobObjectW(core::ptr::null(), core::ptr::null());
            if raw.is_null() || raw == INVALID_HANDLE_VALUE {
                return None;
            }
            let handle = OwnedHandle::from_raw_handle(raw as RawHandle);

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = core::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                handle.as_raw_handle() as HANDLE,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const core::ffi::c_void,
                core::mem::size_of_val(&info) as u32,
            ) == 0
            {
                return None;
            }

            Some(Self { _handle: handle })
        }
    }

    fn assign(self, process: HANDLE) -> Option<Self> {
        let assigned =
            unsafe { AssignProcessToJobObject(self._handle.as_raw_handle() as HANDLE, process) };
        (assigned != 0).then_some(self)
    }

    pub(crate) fn for_child(child: &Child) -> Option<Self> {
        Self::create()?.assign(child.as_raw_handle() as HANDLE)
    }

    pub(crate) fn for_pid(pid: u32) -> Option<Self> {
        if pid == 0 {
            return None;
        }
        unsafe {
            let process = OpenProcess(PROCESS_TERMINATE | PROCESS_SET_QUOTA, 0, pid);
            if process.is_null() || process == INVALID_HANDLE_VALUE {
                return None;
            }
            let process = OwnedHandle::from_raw_handle(process as RawHandle);
            Self::create()?.assign(process.as_raw_handle() as HANDLE)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    #[test]
    fn job_kill_on_close_reaps_the_child() {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut child = Command::new("powershell.exe")
            .args(["-NoLogo", "-Command", "Start-Sleep -Seconds 30"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn sleep");
        let job = Job::for_child(&child).expect("create and assign job");
        drop(job);

        let deadline = Instant::now() + Duration::from_secs(5);
        let reaped = loop {
            if child.try_wait().ok().flatten().is_some() {
                break true;
            }
            if Instant::now() >= deadline {
                break false;
            }
            std::thread::sleep(Duration::from_millis(50));
        };
        assert!(reaped, "kill-on-close should reap the sleeper within 5 s");
        let _ = child.kill();
        let _ = child.wait();
    }
}
