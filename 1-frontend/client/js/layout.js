
"use strict";

(() => {
    // ==========================================
    // KONFIGURASI
    // ==========================================
    const API_BASE_URL = "http://localhost:8080";
    const LOGIN_URL = "http://localhost:8081/login.html";
    const SIDEBAR_URL = "../components/sidebar.html";

    const ROLE_DASHBOARDS = {
        admin: "http://localhost:8081/client/admin/dashboard.html",
        teknisi: "http://localhost:8081/client/teknisi/dashboard.html",
        user: "http://localhost:8081/client/user/dashboard.html"
    };

    // Hindari inisialisasi berulang
    if (window.layoutInitialized) return;

    window.layoutInitialized = true;
    window.isRedirecting = false;
    window.currentUser = null;

    // ==========================================
    // REDIRECT
    // ==========================================
    function redirectToLogin(
        message = "Sesi login berakhir. Silakan login kembali."
    ) {
        if (window.isRedirecting) return;

        window.isRedirecting = true;

        const redirect = () => {
            window.location.replace(LOGIN_URL);
        };

        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "warning",
                title: "Akses Tidak Valid",
                text: message,
                confirmButtonText: "Login Kembali",
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(redirect);
        } else {
            alert(message);
            redirect();
        }
    }

    window.redirectToLogin = redirectToLogin;

    // ==========================================
    // DETEKSI HALAMAN PUBLIK
    // ==========================================
    function isPublicPage() {
        const path = window.location.pathname.toLowerCase();

        return (
            path.endsWith("/login.html") ||
            path.endsWith("/register.html")
        );
    }

    // ==========================================
    // DETEKSI ROLE YANG DIPERLUKAN HALAMAN
    // ==========================================
    function getRequiredRole() {
        const path = window.location.pathname
            .replace(/\/+$/, "")
            .toLowerCase();

        const match = path.match(
            /\/(admin|teknisi|user)(?:\/|$)/
        );

        return match ? match[1] : null;
    }

    // ==========================================
    // CEK AUTENTIKASI DAN ROLE
    // ==========================================
    async function checkAuth() {
        if (isPublicPage()) return true;

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

            if (response.status === 401) {
                redirectToLogin(
                    "Sesi login kedaluwarsa. Silakan login kembali."
                );
                return false;
            }

            if (response.status === 403) {
                redirectToLogin(
                    "Kamu tidak memiliki izin untuk mengakses halaman ini."
                );
                return false;
            }

            if (!response.ok) {
                console.error(
                    "[AUTH] Error API /api/me:",
                    response.status
                );

                return false;
            }

            const result = await response.json();
            const user = result.data || result.user;

            if (!user || !user.role) {
                redirectToLogin(
                    "Data pengguna atau role tidak valid."
                );
                return false;
            }

            // Normalisasi role
            const role = String(user.role)
                .trim()
                .toLowerCase();

            // Hanya role yang diizinkan
            if (!Object.prototype.hasOwnProperty.call(
                ROLE_DASHBOARDS,
                role
            )) {
                console.error("[AUTH] Role tidak dikenal:", role);

                redirectToLogin(
                    "Role akun tidak dikenali. Silakan hubungi administrator."
                );

                return false;
            }

            user.role = role;
            window.currentUser = user;

            console.log("[AUTH] Login valid. Role:", role);

            // ==========================================
            // CEK ROLE TERHADAP HALAMAN YANG DIAKSES
            // ==========================================
            const requiredRole = getRequiredRole();

            if (requiredRole && requiredRole !== role) {
                console.warn(
                    `[AUTH] Role ${role} tidak boleh mengakses halaman ${requiredRole}.`
                );

                window.location.replace(
                    ROLE_DASHBOARDS[role]
                );

                return false;
            }

            // ==========================================
            // HALAMAN DASHBOARD UMUM
            // Arahkan ke dashboard sesuai role
            // ==========================================
            if (!requiredRole) {
                const currentPath = window.location.pathname
                    .replace(/\/+$/, "")
                    .toLowerCase();

                const isGenericDashboard =
                    currentPath.endsWith("/dashboard.html") ||
                    currentPath === "/" ||
                    currentPath.endsWith("/index.html");

                if (isGenericDashboard) {
                    window.location.replace(
                        ROLE_DASHBOARDS[role]
                    );

                    return false;
                }
            }

            return true;

        } catch (error) {
            console.error(
                "[AUTH] Gagal memeriksa autentikasi:",
                error
            );

            return false;
        }
    }

    // ==========================================
    // LOAD SIDEBAR
    // ==========================================
    async function loadSidebar() {
        const sidebar = document.getElementById(
            "sidebar-container"
        );

        if (!sidebar) {
            console.warn("[LAYOUT] Sidebar container tidak ditemukan.");
            return;
        }

        try {
            const response = await fetch(SIDEBAR_URL, {
                cache: "no-cache"
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            sidebar.innerHTML = await response.text();

            setActiveMenu(sidebar);
            setupLogout(sidebar);

            console.log("[LAYOUT] Sidebar berhasil dimuat.");

        } catch (error) {
            console.error("[LAYOUT] Gagal memuat sidebar:", error);

            sidebar.innerHTML = `
                <div class="alert alert-danger m-3">
                    Sidebar gagal dimuat. Periksa path file.
                </div>
            `;
        }
    }

    // ==========================================
    // MENU AKTIF
    // ==========================================
    function setActiveMenu(sidebar) {
        const currentPath = window.location.pathname
            .replace(/\/+$/, "")
            .toLowerCase();

        sidebar.querySelectorAll("a[href]").forEach((link) => {
            const href = link.getAttribute("href");

            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("javascript:")
            ) return;

            try {
                const url = new URL(href, window.location.href);

                if (url.origin !== window.location.origin) return;

                const linkPath = url.pathname
                    .replace(/\/+$/, "")
                    .toLowerCase();

                if (linkPath === currentPath) {
                    link.classList.add("active");
                    link.setAttribute("aria-current", "page");
                } else {
                    link.classList.remove("active");
                    link.removeAttribute("aria-current");
                }
            } catch (error) {
                console.warn("[LAYOUT] Link tidak valid:", href);
            }
        });
    }

    // ==========================================
    // LOGOUT
    // ==========================================
    function setupLogout(sidebar) {
        const button = sidebar.querySelector("#logoutButton");

        if (!button) {
            console.warn("[LAYOUT] Tombol logout tidak ditemukan.");
            return;
        }

        button.addEventListener("click", async (event) => {
            event.preventDefault();

            if (button.dataset.loading === "true") return;

            button.dataset.loading = "true";
            button.disabled = true;

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/auth/logout`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            Accept: "application/json"
                        }
                    }
                );

                if (!response.ok) {
                    console.error(
                        "[LAYOUT] Logout API gagal:",
                        response.status
                    );
                }
            } catch (error) {
                console.error("[LAYOUT] Request logout gagal:", error);
            } finally {
                // Jangan menampilkan pesan sesi kedaluwarsa
                // untuk proses logout yang disengaja.
                window.isRedirecting = true;
                window.location.replace(LOGIN_URL);
            }
        });
    }

    // ==========================================
    // INISIALISASI
    // ==========================================
    document.addEventListener("DOMContentLoaded", async () => {
        console.log("[LAYOUT] Inisialisasi dimulai.");

        if (isPublicPage()) return;

        const authenticated = await checkAuth();

        if (!authenticated || window.isRedirecting) return;

        await loadSidebar();
    });
})();
