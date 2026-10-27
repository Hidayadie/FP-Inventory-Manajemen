
"use strict";

(() => {
    // ==========================================
    // KONFIGURASI
    // ==========================================
    const API_BASE_URL = "http://localhost:8080";
    const LOGIN_URL = "http://localhost:8081/login.html";

    // Hindari inisialisasi berulang
    if (window.authInitialized) {
        return;
    }

    window.authInitialized = true;
    window.isRedirecting = false;
    window.currentUser = null;

    // ==========================================
    // REDIRECT KE HALAMAN LOGIN
    // ==========================================
    window.redirectToLogin = function (
        message = "Sesi login berakhir. Silakan login kembali."
    ) {
        if (window.isRedirecting) {
            return;
        }

        window.isRedirecting = true;

        const redirect = () => {
            window.location.replace(LOGIN_URL);
        };

        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "warning",
                title: "Sesi Berakhir!",
                text: message,
                confirmButtonText: "Login Kembali",
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(redirect);
        } else {
            Swal.fire({
                icon: "warning",
                title: "Sesi Berakhir!",
                text: message,
                confirmButtonText: "Login Kembali",
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(redirect);
        }
    };

    // ==========================================
    // PEMERIKSAAN AUTENTIKASI
    // ==========================================
    window.authReady = (async () => {
        const pathname = window.location.pathname
            .replace(/\/+$/, "")
            .toLowerCase();

        // Tidak memeriksa sesi pada halaman login/register
        if (
            pathname.endsWith("/login.html") ||
            pathname.endsWith("/register.html")
        ) {
            return true;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/me`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Accept: "application/json"
                    },
                    cache: "no-store"
                }
            );

            // Sesi tidak valid atau kedaluwarsa
            if (response.status === 401) {
                window.redirectToLogin();
                return false;
            }

            // Tidak memiliki izin
            if (response.status === 403) {
                window.redirectToLogin(
                    "Akses ditolak atau sesi tidak memiliki izin."
                );
                return false;
            }

            // Error server bukan otomatis token kedaluwarsa
            if (!response.ok) {
                console.error(
                    "[AUTH] Gagal memeriksa sesi:",
                    response.status,
                    response.statusText
                );

                return false;
            }

            const result = await response.json();
            const user = result.data || result.user;

            if (!user || !user.role) {
                console.error(
                    "[AUTH] Data pengguna atau role tidak ditemukan."
                );

                window.redirectToLogin(
                    "Data sesi tidak valid. Silakan login kembali."
                );

                return false;
            }

            // Simpan informasi pengguna
            window.currentUser = user;

            console.log(
                "[AUTH] Autentikasi berhasil:",
                user.role
            );

            return true;

        } catch (error) {
            console.error(
                "[AUTH] Tidak dapat memeriksa sesi:",
                error
            );

            // Gangguan jaringan tidak langsung dianggap
            // sebagai token kedaluwarsa.
            return false;
        }
    })();

})();
