//! Owner-only DACL for secret files. Unix analog: `chmod 0o600`.

use std::path::Path;

use windows_sys::Win32::Foundation::{LocalFree, FALSE, HLOCAL};
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SetNamedSecurityInfoW, SDDL_REVISION_1,
    SE_FILE_OBJECT,
};
use windows_sys::Win32::Security::{
    GetSecurityDescriptorDacl, ACL, DACL_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION,
    PSECURITY_DESCRIPTOR,
};

/// Restrict `path` to the file owner and SYSTEM (`D:P(A;;FA;;;OW)(A;;FA;;;SY)`).
pub fn restrict_owner_acl(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let sddl: Vec<u16> = "D:P(A;;FA;;;OW)(A;;FA;;;SY)\0".encode_utf16().collect();
    let mut sd: PSECURITY_DESCRIPTOR = std::ptr::null_mut();
    unsafe {
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            SDDL_REVISION_1,
            &mut sd,
            std::ptr::null_mut(),
        ) == 0
        {
            return Err("Failed to build secret-file ACL".into());
        }
        let mut present = FALSE;
        let mut dacl: *mut ACL = std::ptr::null_mut();
        let mut defaulted = FALSE;
        if GetSecurityDescriptorDacl(sd, &mut present, &mut dacl, &mut defaulted) == 0 {
            let _ = LocalFree(sd as HLOCAL);
            return Err("Failed to read secret-file ACL".into());
        }
        let status = SetNamedSecurityInfoW(
            wide.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            dacl,
            std::ptr::null(),
        );
        let _ = LocalFree(sd as HLOCAL);
        if status != 0 {
            return Err("Failed to restrict secret-file ACL".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restrict_owner_acl_succeeds_on_a_temp_file() {
        let path =
            std::env::temp_dir().join(format!("monocode-secret-acl-{}.txt", std::process::id()));
        std::fs::write(&path, b"secret").unwrap();
        restrict_owner_acl(&path).expect("owner ACL");
        let _ = std::fs::remove_file(&path);
    }
}
