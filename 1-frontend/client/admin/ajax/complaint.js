/**
 * CRUD Keluhan - Sistem Inventaris Cerdas
 * jQuery AJAX + Bootstrap 5 + SweetAlert2
 *
 * Fitur:
 * - User ID otomatis dari GET /api/me
 * - Dropdown aset dari GET /api/private/assets
 * - Upload gambar saat tambah dan edit keluhan
 * - Menampilkan gambar lama pada modal edit
 * - Gambar lama dipertahankan jika tidak memilih gambar baru
 * - Detail, filter, hapus, dan status perbaikan
 */

"use strict";

const API_BASE = "http://localhost:8080/api/private";
const COMPLAINT_URL = `${API_BASE}/complaints`;
const ASSET_URL = `${API_BASE}/assets`;
const ME_URL = "http://localhost:8080/api/me";
const IMAGE_BASE_URL = "http://localhost:8080";

$(document).ready(function () {
    // ==================================================
    // REFERENSI ELEMENT
    // ==================================================

    const $tableBody = $("#complaintTableBody");
    const $alert = $("#complaintAlert");
    const $search = $("#complaintSearch");
    const $statusFilter = $("#statusFilter");
    const $unfixedFilter = $("#unfixedFilter");
    const $refresh = $("#refreshComplaints");
    const $count = $("#complaintCount");

    const $addForm = $("#addComplaintForm");
    const $editForm = $("#editComplaintForm");

    const $addAlert = $("#addComplaintAlert");
    const $editAlert = $("#editComplaintAlert");

    const $saveButton = $("#saveComplaintButton");
    const $updateButton = $("#updateComplaintButton");

    const addModalEl = document.getElementById("addComplaintModal");
    const editModalEl = document.getElementById("editComplaintModal");
    const detailModalEl = document.getElementById("detailComplaintModal");

    let complaints = [];
    let currentUserID = null;
    let assetOptionsLoaded = false;

    // ==================================================
    // HELPER AJAX
    // ==================================================

    function ajaxOptions(options) {
        options.xhrFields = {
            withCredentials: true
        };

        options.headers = Object.assign(
            {
                Accept: "application/json"
            },
            options.headers || {}
        );

        return options;
    }

    function apiErrorMessage(xhr, fallback) {
        const response = xhr.responseJSON || {};

        if (response.error) return response.error;
        if (response.message) return response.message;

        if (xhr.status === 401 || xhr.status === 403) {
            return "Sesi login berakhir atau akses ditolak. Silakan login kembali.";
        }
        
        if (xhr.status === 404) {
            return "Endpoint atau data tidak ditemukan.";
        }

        if (xhr.status === 413) {
            return "Ukuran file terlalu besar.";
        }

        if (xhr.status === 0) {
            return "Tidak dapat terhubung ke server API. Periksa server dan konfigurasi CORS.";
        }

        return `${fallback} (HTTP ${xhr.status}).`;
    }

    function extractPayload(response) {
        if (response && response.data !== undefined) {
            return response.data;
        }

        if (response && response.user !== undefined) {
            return response.user;
        }

        return response;
    }

    // ==================================================
    // HELPER TAMPILAN
    // ==================================================

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showAlert(message, type = "danger") {
        $alert
            .removeClass(
                "d-none alert-success alert-danger alert-warning alert-info"
            )
            .addClass(`alert-${type}`)
            .text(message);
    }

    function hideAlert() {
        $alert
            .addClass("d-none")
            .removeClass(
                "alert-success alert-danger alert-warning alert-info"
            )
            .text("");
    }

    function showModalAlert($target, message, type = "danger") {
        $target
            .removeClass(
                "d-none alert-success alert-danger alert-warning alert-info"
            )
            .addClass(`alert-${type}`)
            .text(message);
    }

    function hideModalAlert($target) {
        $target
            .addClass("d-none")
            .removeClass(
                "alert-success alert-danger alert-warning alert-info"
            )
            .text("");
    }

    function formatDate(value) {
        if (!value) return "-";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta"
        });
    }

    function resolveImageURL(imagePath) {
        if (!imagePath) return "";

        if (/^https?:\/\//i.test(imagePath)) {
            return imagePath;
        }

        const normalizedPath = String(imagePath).startsWith("/")
            ? String(imagePath)
            : `/${imagePath}`;

        return `${IMAGE_BASE_URL}${normalizedPath}`;
    }

    function normalizedStatus(item) {
        if (
            item.is_fixed === true ||
            item.is_fixed === "true"
        ) {
            return "resolved";
        }

        return String(item.status || "low").toLowerCase();
    }

    function renderStatusBadge(status) {
        const value = String(status || "low").toLowerCase();

        const classes = {
            low: "status-low",
            medium: "status-medium",
            high: "status-high",
            critical: "status-critical",
            resolved: "status-resolved"
        };

        const labels = {
            low: "Low",
            medium: "Medium",
            high: "High",
            critical: "Critical",
            resolved: "Resolved"
        };

        return `
            <span class="badge-status ${classes[value] || "status-other"}">
                ${labels[value] || escapeHtml(value)}
            </span>
        `;
    }

    function renderFixedBadge(isFixed) {
        if (isFixed === true || isFixed === "true") {
            return `
                <span class="badge bg-success-subtle text-success border border-success-subtle">
                    <i class="bi bi-check-circle me-1"></i>Selesai
                </span>
            `;
        }

        return `
            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                <i class="bi bi-clock me-1"></i>Belum
            </span>
        `;
    }

    function renderPriority(value) {
        const priority = Number(value ?? 0);

        const safeValue = Number.isFinite(priority)
            ? Math.max(0, Math.min(1, priority))
            : 0;

        return `
            <div class="d-flex align-items-center gap-2">
                <div class="priority-track">
                    <div class="priority-fill"
                         style="width:${safeValue * 100}%"></div>
                </div>
                <span>${safeValue.toFixed(1)}</span>
            </div>
        `;
    }

    // ==================================================
    // USER LOGIN
    // ==================================================

    function findUserID(value) {
        if (!value || typeof value !== "object") {
            return null;
        }

        const id =
            value.id ??
            value.userID ??
            value.user_id ??
            value.userId ??
            value.sub;

        if (
            id !== undefined &&
            id !== null &&
            String(id).trim() !== ""
        ) {
            return String(id);
        }

        if (value.data) {
            const result = findUserID(value.data);
            if (result) return result;
        }

        if (value.user) {
            const result = findUserID(value.user);
            if (result) return result;
        }

        if (value.claims) {
            const result = findUserID(value.claims);
            if (result) return result;
        }

        return null;
    }

    function loadCurrentUser() {
        currentUserID = null;

        $("#addUserID").val("");

        $.ajax(ajaxOptions({
            url: ME_URL,
            method: "GET",
            dataType: "json",

            success: function (response) {
                const payload = extractPayload(response);

                currentUserID =
                    findUserID(payload) ||
                    findUserID(response);

                if (currentUserID) {
                    $("#addUserID").val(currentUserID);
                } else {
                    showModalAlert(
                        $addAlert,
                        "ID pengguna tidak ditemukan pada respons GET /api/me."
                    );

                    console.error(
                        "Respons GET /api/me:",
                        response
                    );
                }
            },

            error: function (xhr) {
                currentUserID = null;

                console.error(
                    "Gagal mengambil User ID:",
                    xhr.status,
                    xhr.responseText
                );

                showModalAlert(
                    $addAlert,
                    apiErrorMessage(
                        xhr,
                        "Gagal mengambil identitas pengguna"
                    )
                );
            }
        }));
    }

    // ==================================================
    // DROPDOWN ASET
    // ==================================================

    function getAssetID(asset) {
        return (
            asset.asset_id ??
            asset.assetID ??
            asset.assetId ??
            asset.id ??
            ""
        );
    }

    function getAssetLabel(asset) {
        const code =
            asset.code_asset ??
            asset.code ??
            asset.asset_code ??
            "";

        const name =
            asset.nama_asset ??
            asset.name ??
            asset.asset_name ??
            asset.title ??
            "Aset tanpa nama";

        return `${code ? code + " - " : ""}${name}`;
    }

    function loadAssetOptions(selectedAssetID = null) {
    $.ajax({
        url: ASSET_URL,
        type: "GET",
        xhrFields: {
            withCredentials: true
        },
        success: function (response) {
            const assets = Array.isArray(response)
                ? response
                : response.data || [];

            const addSelect = $("#addAssetID");
            const editSelect = $("#editAssetID");

            addSelect.empty().append('<option value="">Pilih Aset</option>');
            editSelect.empty().append('<option value="">Pilih Aset</option>');

            assets.forEach(function (asset) {
                const id = asset.asset_id ?? asset.assetID ?? asset.assetId ?? asset.id;
                const name = asset.nama_asset ?? asset.name ?? asset.namaAsset ?? asset.code_asset;

                if (id == null) return;

                const label = name || `Aset ${id}`;
                const option = new Option(label, id);

                addSelect.append($(option).clone());
                editSelect.append($(option).clone());
            });

            if (selectedAssetID != null) {
                editSelect.val(String(selectedAssetID));
            }
        },
        error: function (xhr) {
            console.error("Gagal memuat data aset:", xhr.responseText);
        }
    });
}
    // ==================================================
    // PREVIEW GAMBAR TAMBAH
    // ==================================================

    function resetAddImagePreview() {
        $("#addImage").val("");
        $("#addImagePreview").attr("src", "");
        $("#addImagePreviewWrapper").addClass("d-none");
    }

    function validateImage(file, $target, inputElement) {
        if (!file) return true;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            if (inputElement) inputElement.value = "";

            showModalAlert(
                $target,
                "Format gambar harus JPG, PNG, atau GIF."
            );

            return false;
        }

        if (file.size > 5 * 1024 * 1024) {
            if (inputElement) inputElement.value = "";

            showModalAlert(
                $target,
                "Ukuran gambar maksimal 5 MB."
            );

            return false;
        }

        return true;
    }

    $("#addImage").on("change", function () {
        const file = this.files?.[0];

        $("#addImagePreview")
            .attr("src", "")
            .closest("#addImagePreviewWrapper")
            .addClass("d-none");

        if (!file) return;

        if (!validateImage(file, $addAlert, this)) {
            resetAddImagePreview();
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
            $("#addImagePreview")
                .attr("src", event.target.result);

            $("#addImagePreviewWrapper")
                .removeClass("d-none");
        };

        reader.onerror = function () {
            showModalAlert(
                $addAlert,
                "Gambar gagal dibaca."
            );
        };

        reader.readAsDataURL(file);
    });

    // ==================================================
    // PREVIEW GAMBAR EDIT
    // ==================================================

    function resetEditImagePreview() {
        $("#editImage").val("");

        // Preview gambar BARU saja.
        $("#editImagePreview")
            .attr("src", "");

        $("#editImagePreviewWrapper")
            .addClass("d-none");

        // Gambar lama ditangani terpisah.
        $("#editCurrentImage")
            .attr("src", "");

        $("#editCurrentImageWrapper")
            .addClass("d-none");
    }

    function showCurrentEditImage(imagePath) {
        const $wrapper = $("#editCurrentImageWrapper");
        const $image = $("#editCurrentImage");

        if (!imagePath) {
            $image.attr("src", "");
            $wrapper.addClass("d-none");
            return;
        }

        $image
            .attr("src", resolveImageURL(imagePath))
            .off("error.complaintImage")
            .on("error.complaintImage", function () {
                console.error(
                    "Gambar lama gagal dimuat:",
                    imagePath
                );

                $wrapper.removeClass("d-none");

                if (!$("#editCurrentImageError").length) {
                    $wrapper.append(`
                        <div id="editCurrentImageError"
                             class="small text-danger mt-2">
                            Gambar tidak dapat ditampilkan.
                            Periksa path image_path dan route static backend.
                        </div>
                    `);
                }
            });

        $("#editCurrentImageError").remove();

        $wrapper.removeClass("d-none");
    }

    $("#editImage").on("change", function () {
        const file = this.files?.[0];

        $("#editImagePreview")
            .attr("src", "");

        $("#editImagePreviewWrapper")
            .addClass("d-none");

        if (!file) return;

        if (!validateImage(file, $editAlert, this)) {
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
            $("#editImagePreview")
                .attr("src", event.target.result);

            $("#editImagePreviewWrapper")
                .removeClass("d-none");
        };

        reader.onerror = function () {
            showModalAlert(
                $editAlert,
                "Gambar baru gagal dibaca."
            );
        };

        reader.readAsDataURL(file);
    });

    // ==================================================
    // RENDER TABEL
    // ==================================================

    function renderTable() {
        const keyword = String($search.val() || "")
            .trim()
            .toLowerCase();

        const selectedStatus = String($statusFilter.val() || "")
            .toLowerCase();

        const onlyUnfixed = $unfixedFilter.is(":checked");

        const filtered = complaints.filter(function (item) {
            const haystack = [
                item.code,
                item.title,
                item.description,
                item.note,
                item.userID,
                item.user_id,
                item.assetID,
                item.asset_id
            ]
                .map(value => String(value ?? ""))
                .join(" ")
                .toLowerCase();

            const matchesKeyword =
                !keyword || haystack.includes(keyword);

            const matchesStatus =
                !selectedStatus ||
                normalizedStatus(item) === selectedStatus;

            const isFixed =
                item.is_fixed === true ||
                item.is_fixed === "true";

            const matchesFixed =
                !onlyUnfixed || !isFixed;

            return (
                matchesKeyword &&
                matchesStatus &&
                matchesFixed
            );
        });

        $tableBody.empty();

        if (filtered.length === 0) {
            $tableBody.html(`
                <tr>
                    <td colspan="10"
                        class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                        Tidak ada data keluhan ditemukan.
                    </td>
                </tr>
            `);

            $count.text(
                `Menampilkan 0 dari ${complaints.length} keluhan`
            );

            return;
        }

        filtered.forEach(function (item, index) {
            const id = item.id;
            const code = item.code || "-";
            const title = item.title || "-";

            const userID =
                item.userID ?? item.user_id ?? "-";

            const assetID =
                item.assetID ?? item.asset_id ?? "-";

            const status = normalizedStatus(item);

            const isFixed =
                item.is_fixed === true ||
                item.is_fixed === "true";

            const $row = $("<tr>");

            $("<td>")
                .addClass("text-center")
                .text(index + 1)
                .appendTo($row);

            $("<td>")
                .html(`
                    <span class="complaint-code font-monospace">
                        ${escapeHtml(code)}
                    </span>
                `)
                .appendTo($row);

            $("<td>")
                .html(`
                    <div class="fw-semibold text-dark">
                        ${escapeHtml(title)}
                    </div>
                    <div class="small text-muted text-truncate"
                         style="max-width:220px">
                        ${escapeHtml(item.description || "")}
                    </div>
                `)
                .appendTo($row);

            $("<td>").text(userID).appendTo($row);
            $("<td>").text(assetID).appendTo($row);

            $("<td>")
                .html(renderPriority(item.priority))
                .appendTo($row);

            $("<td>")
                .html(renderStatusBadge(status))
                .appendTo($row);

            $("<td>")
                .html(renderFixedBadge(isFixed))
                .appendTo($row);

            $("<td>")
                .addClass("small text-muted")
                .text(formatDate(item.created_at))
                .appendTo($row);

            const $actionTd = $("<td>")
                .addClass("text-center");

            const $actionGroup = $("<div>")
                .addClass("btn-group btn-group-sm")
                .attr("role", "group");

            $("<button>", {
                type: "button",
                class: "btn btn-outline-info btn-detail-complaint",
                title: "Detail Keluhan"
            })
                .attr("data-id", id)
                .html('<i class="bi bi-eye"></i>')
                .appendTo($actionGroup);

            $("<button>", {
                type: "button",
                class: "btn btn-outline-warning btn-edit-complaint",
                title: "Ubah Keluhan"
            })
                .attr("data-id", id)
                .html('<i class="bi bi-pencil-square"></i>')
                .appendTo($actionGroup);

            $("<button>", {
                type: "button",
                class: "btn btn-outline-danger btn-delete-complaint",
                title: "Hapus Keluhan"
            })
                .attr("data-id", id)
                .attr("data-name", title)
                .attr("data-code", code)
                .html('<i class="bi bi-trash"></i>')
                .appendTo($actionGroup);

            const $fixedSwitch = $(`
              <div class="form-check form-switch d-inline-flex align-items-center ms-2 mb-0">
    <input
        class="form-check-input complaint-fixed-switch"
        type="checkbox"
        role="switch"
        title="Tandai sudah diperbaiki"
        aria-label="Tandai keluhan sudah diperbaiki">
</div>
            `);

            $fixedSwitch.find("input")
                .attr("data-id", id)
                .prop("checked", isFixed)
                .prop("disabled", isFixed);

            $actionTd.append($actionGroup, $fixedSwitch);
            $row.append($actionTd);
            $tableBody.append($row);
        });

        $count.text(
            `Menampilkan ${filtered.length} dari ${complaints.length} keluhan`
        );
    }

    // ==================================================
    // MEMUAT DATA KELUHAN
    // ==================================================

    function loadComplaints() {
        $refresh.prop("disabled", true);
        hideAlert();

        $tableBody.html(`
            <tr>
                <td colspan="10" class="text-center py-4">
                    <span class="spinner-border spinner-border-sm
                                 text-primary me-2"></span>
                    Memuat data keluhan...
                </td>
            </tr>
        `);

        $.ajax(ajaxOptions({
            url: COMPLAINT_URL,
            method: "GET",
            dataType: "json",
            cache: false,

            success: function (response) {
                if (!response || !Array.isArray(response.data)) {
                    showAlert(
                        "Format respons API tidak valid. Endpoint diharapkan mengembalikan data berupa array."
                    );

                    $tableBody.html(`
                        <tr>
                            <td colspan="10"
                                class="text-center text-danger py-4">
                                Format data tidak valid.
                            </td>
                        </tr>
                    `);

                    return;
                }

                complaints = response.data;
                renderTable();

                if (complaints.length === 0) {
                    showAlert(
                        "Belum ada data keluhan yang terdaftar.",
                        "info"
                    );
                }
            },

            error: function (xhr, status, error) {
                console.error(
                    "Gagal memuat keluhan:",
                    xhr.status,
                    status,
                    error,
                    xhr.responseText
                );

                const message = apiErrorMessage(
                    xhr,
                    "Gagal memuat data keluhan"
                );

                showAlert(message);

                $tableBody.html(`
                    <tr>
                        <td colspan="10"
                            class="text-center text-danger py-4">
                            ${escapeHtml(message)}
                        </td>
                    </tr>
                `);
            },

            complete: function () {
                $refresh.prop("disabled", false);
            }
        }));
    }

    $search.on("input", renderTable);
    $statusFilter.on("change", renderTable);
    $unfixedFilter.on("change", renderTable);
    $refresh.on("click", loadComplaints);

    // ==================================================
    // TAMBAH KELUHAN
    // ==================================================

    $("#addComplaintButton").on("click", function () {
        $addForm[0].reset();

        $("#addPriority").val("0.3");
        $("#addStatus").val("low");

        hideModalAlert($addAlert);
        resetAddImagePreview();

        if (addModalEl) {
            bootstrap.Modal
                .getOrCreateInstance(addModalEl)
                .show();
        }

        loadCurrentUser();
        loadAssetOptions();
    });

    $(document).on("click", ".btn-edit-complaint", function () {
    const id = $(this).data("id");

    $.ajax({
        url: `${COMPLAINT_URL}/${id}`,
        type: "GET",
        xhrFields: {
            withCredentials: true
        },
        success: function (response) {
            const data = response.data || response;

            // Isi field modal ubah
            $("#editComplaintId").val(data.id);
            $("#editUserID").val(data.userID ?? data.user_id ?? "");
            $("#editTitle").val(data.title ?? "");
            $("#editDescription").val(data.description ?? "");
            $("#editPriority").val(data.priority ?? "");
            $("#editStatus").val(data.status ?? "");
            $("#editNote").val(data.note ?? "");
            $("#editIsFixed").prop(
                "checked",
                data.is_fixed === true || data.isFixed === true
            );

            // Muat dropdown aset dan pilih aset milik keluhan
            loadAssetOptions(
                data.assetID ?? data.asset_id ?? data.assetId
            );

            // Tampilkan modal ubah
            $("#editComplaintModal").modal("show");
        },
        error: function (xhr) {
            Swal.fire(
                "Gagal",
                xhr.responseJSON?.message || "Data keluhan gagal dimuat.",
                "error"
            );
        }
    });
});

    $addForm.on("submit", function (event) {
        event.preventDefault();

        hideModalAlert($addAlert);

        const userID = String(
            currentUserID || $("#addUserID").val() || ""
        ).trim();

        const assetID = String(
            $("#addAssetID").val() || ""
        ).trim();

        const title = String(
            $("#addTitle").val() || ""
        ).trim();

        const description = String(
            $("#addDescription").val() || ""
        ).trim();

        const priority = Number(
            $("#addPriority").val() || 0
        );

        const status = $("#addStatus").val();

        const note = String(
            $("#addNote").val() || ""
        ).trim();

        if (!userID) {
            showModalAlert(
                $addAlert,
                "User ID belum tersedia. Pastikan Anda sudah login."
            );
            return;
        }

        if (!assetID || !assetOptionsLoaded) {
            showModalAlert(
                $addAlert,
                "Pilih aset dari dropdown setelah daftar aset berhasil dimuat."
            );
            return;
        }

        if (!title || !description) {
            showModalAlert(
                $addAlert,
                "Judul dan deskripsi keluhan wajib diisi."
            );
            return;
        }

        if (
            !Number.isFinite(priority) ||
            priority < 0 ||
            priority > 1
        ) {
            showModalAlert(
                $addAlert,
                "Prioritas harus berada di antara 0 dan 1."
            );
            return;
        }

        const imageFile = $("#addImage")[0]?.files?.[0];

        if (
            imageFile &&
            !validateImage(imageFile, $addAlert, $("#addImage")[0])
        ) {
            return;
        }

        $saveButton
            .prop("disabled", true)
            .html(`
                <span class="spinner-border spinner-border-sm me-2"></span>
                Menyimpan...
            `);

        const formData = new FormData();

        formData.append("userID", userID);
        formData.append("assetID", assetID);
        formData.append("title", title);
        formData.append("description", description);
        formData.append("priority", String(priority));
        formData.append("status", status);
        formData.append("note", note);

        if (imageFile) {
            formData.append("image", imageFile);
        }

        $.ajax(ajaxOptions({
            url: COMPLAINT_URL,
            method: "POST",
            contentType: false,
            processData: false,
            dataType: "json",
            data: formData,

            success: function (response) {
                if (addModalEl) {
                    bootstrap.Modal
                        .getOrCreateInstance(addModalEl)
                        .hide();
                }

                $addForm[0].reset();
                resetAddImagePreview();

                loadComplaints();

                Swal.fire({
                    icon: "success",
                    title: "Berhasil!",
                    text: response.message ||
                        "Keluhan berhasil ditambahkan.",
                    timer: 2000,
                    showConfirmButton: false
                });
            },

            error: function (xhr) {
                console.error(
                    "Gagal menambahkan keluhan:",
                    xhr.status,
                    xhr.responseText
                );

                showModalAlert(
                    $addAlert,
                    apiErrorMessage(
                        xhr,
                        "Keluhan gagal ditambahkan"
                    )
                );
            },

            complete: function () {
                $saveButton
                    .prop("disabled", false)
                    .html(
                        '<i class="bi bi-save me-1"></i> Simpan Keluhan'
                    );
            }
        }));
    });

    // ==================================================
    // DETAIL KELUHAN
    // ==================================================

    $(document).on(
        "click",
        ".btn-detail-complaint",
        function () {
            const id = $(this).attr("data-id");

            if (!id) {
                Swal.fire(
                    "Error",
                    "ID keluhan tidak ditemukan.",
                    "error"
                );
                return;
            }

            const item = complaints.find(
                complaint => String(complaint.id) === String(id)
            );

            if (item) {
                displayDetail(item);
                return;
            }

            $.ajax(ajaxOptions({
                url: `${COMPLAINT_URL}/${encodeURIComponent(id)}`,
                method: "GET",
                dataType: "json",

                success: function (response) {
                    displayDetail(response.data || response);
                },

                error: function (xhr) {
                    Swal.fire(
                        "Error",
                        apiErrorMessage(
                            xhr,
                            "Gagal memuat detail keluhan"
                        ),
                        "error"
                    );
                }
            }));
        }
    );

    function displayDetail(item) {
        $("#detailComplaintCode").text(item.code || "-");
        $("#detailComplaintTitle").text(item.title || "-");

        $("#detailComplaintUser").text(
            item.userID ?? item.user_id ?? "-"
        );

        $("#detailComplaintAsset").text(
            item.assetID ?? item.asset_id ?? "-"
        );

        $("#detailComplaintPriority").text(
            Number(item.priority ?? 0).toFixed(2)
        );

        $("#detailComplaintStatus").html(
            renderStatusBadge(normalizedStatus(item))
        );

        $("#detailComplaintFixed").html(
            renderFixedBadge(item.is_fixed)
        );

        $("#detailComplaintDescription").text(
            item.description || "-"
        );

        $("#detailComplaintNote").text(
            item.note || "-"
        );

        $("#detailComplaintCreated").text(
            formatDate(item.created_at)
        );

        $("#detailComplaintUpdated").text(
            formatDate(item.updated_at)
        );

        $("#btnDetailToEditComplaint").attr(
            "data-id",
            item.id
        );

        // Area gambar detail dibuat otomatis bila belum tersedia.
        let $imageWrapper = $("#detailComplaintImageWrapper");

        if (!$imageWrapper.length) {
            $("#detailComplaintDescription")
                .closest(".col-12")
                .after(`
                    <div class="col-12 d-none"
                         id="detailComplaintImageWrapper">
                        <div class="p-3 bg-light rounded border">
                            <div class="text-muted small mb-2">
                                Lampiran Gambar
                            </div>
                            <img
                                id="detailComplaintImage"
                                class="img-fluid rounded"
                                alt="Lampiran keluhan"
                                style="max-height:320px;object-fit:contain;">
                        </div>
                    </div>
                `);

            $imageWrapper = $("#detailComplaintImageWrapper");
        }

        if (item.image_path) {
            $("#detailComplaintImage")
                .attr("src", resolveImageURL(item.image_path));

            $imageWrapper.removeClass("d-none");
        } else {
            $("#detailComplaintImage").attr("src", "");
            $imageWrapper.addClass("d-none");
        }

        if (detailModalEl) {
            bootstrap.Modal
                .getOrCreateInstance(detailModalEl)
                .show();
        }
    }

    $("#btnDetailToEditComplaint").on("click", function () {
        const id = $(this).attr("data-id");

        if (detailModalEl) {
            bootstrap.Modal
                .getOrCreateInstance(detailModalEl)
                .hide();
        }

        if (id) {
            openEditModal(id);
        }
    });

    // ==================================================
    // EDIT KELUHAN
    // ==================================================

    $(document).on(
        "click",
        ".btn-edit-complaint",
        function () {
            const id = $(this).attr("data-id");

            if (!id) {
                Swal.fire(
                    "Error",
                    "ID keluhan tidak ditemukan.",
                    "error"
                );
                return;
            }

            openEditModal(id);
        }
    );

    function openEditModal(id) {
        hideModalAlert($editAlert);
        $editForm[0].reset();
        resetEditImagePreview();

        Swal.fire({
            title: "Memuat Data...",
            text: "Mengambil data keluhan dari server",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        $.ajax(ajaxOptions({
            url: `${COMPLAINT_URL}/${encodeURIComponent(id)}`,
            method: "GET",
            dataType: "json",

            success: function (response) {
                Swal.close();

                const item = response.data || response;

                if (!item || !item.id) {
                    Swal.fire(
                        "Error",
                        "Data keluhan tidak ditemukan.",
                        "error"
                    );
                    return;
                }

                $("#editComplaintId").val(item.id);

                $("#editUserID").val(
                    item.userID ?? item.user_id ?? ""
                );

                $("#editAssetID").val(
                    item.assetID ?? item.asset_id ?? ""
                );

                $("#editTitle").val(item.title || "");

                $("#editDescription").val(
                    item.description || ""
                );

                $("#editPriority").val(item.priority ?? 0);

                const currentStatus = String(
                    item.status || "low"
                ).toLowerCase();

                $("#editStatus").val(
                    [
                        "low",
                        "medium",
                        "high",
                        "critical"
                    ].includes(currentStatus)
                        ? currentStatus
                        : "low"
                );

                $("#editNote").val(item.note || "");

                // Gambar lama ditampilkan terpisah dari preview gambar baru.
                showCurrentEditImage(item.image_path);

                $("#editIsFixed").prop(
                    "checked",
                    item.is_fixed === true ||
                    item.is_fixed === "true"
                );

                if (editModalEl) {
                    bootstrap.Modal
                        .getOrCreateInstance(editModalEl)
                        .show();
                }
            },

            error: function (xhr) {
                console.error(
                    "Gagal mengambil data edit:",
                    xhr.status,
                    xhr.responseText
                );

                Swal.fire(
                    "Gagal Mengambil Data",
                    apiErrorMessage(
                        xhr,
                        "Gagal memuat detail keluhan"
                    ),
                    "error"
                );
            }
        }));
    }

    $editForm.on("submit", function (event) {
        event.preventDefault();

        hideModalAlert($editAlert);

        const id = $("#editComplaintId").val();

        if (!id) {
            showModalAlert(
                $editAlert,
                "ID keluhan tidak ditemukan. Muat ulang halaman."
            );
            return;
        }

        const payload = {
            userID: String($("#editUserID").val() || "").trim(),
            assetID: String($("#editAssetID").val() || "").trim(),
            title: String($("#editTitle").val() || "").trim(),
            description: String(
                $("#editDescription").val() || ""
            ).trim(),
            priority: Number($("#editPriority").val()),
            status: $("#editStatus").val(),
            note: String($("#editNote").val() || "").trim(),
            is_fixed: $("#editIsFixed").is(":checked")
        };

        if (!payload.userID) {
            showModalAlert(
                $editAlert,
                "User ID wajib tersedia."
            );
            return;
        }

        if (!payload.assetID) {
            showModalAlert(
                $editAlert,
                "Asset ID wajib diisi."
            );
            return;
        }

        if (!payload.title || !payload.description) {
            showModalAlert(
                $editAlert,
                "Judul dan deskripsi keluhan wajib diisi."
            );
            return;
        }

        if (
            !Number.isFinite(payload.priority) ||
            payload.priority < 0 ||
            payload.priority > 1
        ) {
            showModalAlert(
                $editAlert,
                "Prioritas harus berada di antara 0 dan 1."
            );
            return;
        }

        const newImage = $("#editImage")[0]?.files?.[0];

        if (
            newImage &&
            !validateImage(newImage, $editAlert, $("#editImage")[0])
        ) {
            return;
        }

        $updateButton
            .prop("disabled", true)
            .html(`
                <span class="spinner-border spinner-border-sm me-2"></span>
                Menyimpan Perubahan...
            `);

        // FormData diperlukan agar gambar dapat dikirim.
        const formData = new FormData();

        formData.append("userID", payload.userID);
        formData.append("assetID", payload.assetID);
        formData.append("title", payload.title);
        formData.append("description", payload.description);
        formData.append("priority", String(payload.priority));
        formData.append("status", payload.status);
        formData.append("note", payload.note);
        formData.append("is_fixed", String(payload.is_fixed));

        // File hanya dikirim jika pengguna memilih gambar baru.
        // Jika kosong, backend diharapkan mempertahankan gambar lama.
        if (newImage) {
            formData.append("image", newImage);
        }

        $.ajax(ajaxOptions({
            url: `${COMPLAINT_URL}/${encodeURIComponent(id)}`,
            method: "PUT",
            contentType: false,
            processData: false,
            dataType: "json",
            data: formData,

            success: function (response) {
                if (editModalEl) {
                    bootstrap.Modal
                        .getOrCreateInstance(editModalEl)
                        .hide();
                }

                $editForm[0].reset();
                resetEditImagePreview();

                loadComplaints();

                Swal.fire({
                    icon: "success",
                    title: "Berhasil!",
                    text: response.message ||
                        "Data keluhan berhasil diperbarui.",
                    timer: 2000,
                    showConfirmButton: false
                });
            },

            error: function (xhr) {
                console.error(
                    "Gagal memperbarui keluhan:",
                    xhr.status,
                    xhr.responseText
                );

                showModalAlert(
                    $editAlert,
                    apiErrorMessage(
                        xhr,
                        "Gagal memperbarui keluhan"
                    )
                );
            },

            complete: function () {
                $updateButton
                    .prop("disabled", false)
                    .html(
                        '<i class="bi bi-save me-1"></i> Simpan Perubahan'
                    );
            }
        }));
    });

    // ==================================================
    // TANDAI KELUHAN SUDAH DIPERBAIKI
    // ==================================================

    $(document).on(
        "change",
        ".complaint-fixed-switch",
        function () {
            const $switch = $(this);
            const id = $switch.attr("data-id");

            if (!id || !$switch.is(":checked")) {
                return;
            }

            $switch.prop("disabled", true);

            $.ajax(ajaxOptions({
                url: `${COMPLAINT_URL}/${encodeURIComponent(id)}`,
                method: "PUT",
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({
                    is_fixed: true
                }),

                success: function (response) {
                    Swal.fire({
                        icon: "success",
                        title: "Berhasil",
                        text: response.message ||
                            "Keluhan ditandai sudah diperbaiki.",
                        timer: 1800,
                        showConfirmButton: false
                    });

                    loadComplaints();
                },

                error: function (xhr) {
                    $switch
                        .prop("checked", false)
                        .prop("disabled", false);

                    Swal.fire(
                        "Gagal",
                        apiErrorMessage(
                            xhr,
                            "Gagal memperbarui status perbaikan"
                        ),
                        "error"
                    );
                }
            }));
        }
    );

    // ==================================================
    // HAPUS KELUHAN
    // ==================================================

    $(document).on(
        "click",
        ".btn-delete-complaint",
        async function () {
            const id = $(this).attr("data-id");
            const name = $(this).attr("data-name") || "keluhan ini";
            const code = $(this).attr("data-code") || "";

            if (!id) {
                Swal.fire(
                    "Error",
                    "ID keluhan tidak ditemukan.",
                    "error"
                );
                return;
            }

            const confirmation = await Swal.fire({
                title: "Hapus Keluhan?",
                html: `
                    Apakah Anda yakin ingin menghapus keluhan
                    <strong>${escapeHtml(name)}</strong>
                    ${code ? " (" + escapeHtml(code) + ")" : ""}?
                `,
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#dc3545",
                cancelButtonColor: "#6c757d",
                confirmButtonText:
                    "<i class='bi bi-trash me-1'></i> Ya, Hapus!",
                cancelButtonText: "Batal"
            });

            if (!confirmation.isConfirmed) {
                return;
            }

            Swal.fire({
                title: "Menghapus...",
                text: "Mohon tunggu sebentar",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            $.ajax(ajaxOptions({
                url: `${COMPLAINT_URL}/${encodeURIComponent(id)}`,
                method: "DELETE",
                dataType: "json",

                success: function (response) {
                    loadComplaints();

                    Swal.fire({
                        icon: "success",
                        title: "Terhapus!",
                        text: response.message ||
                            "Keluhan berhasil dihapus.",
                        timer: 1800,
                        showConfirmButton: false
                    });
                },

                error: function (xhr) {
                    Swal.fire(
                        "Gagal Menghapus",
                        apiErrorMessage(
                            xhr,
                            "Gagal menghapus keluhan"
                        ),
                        "error"
                    );
                }
            }));
        }
    );

    // ==================================================
    // INISIALISASI
    // ==================================================

    loadComplaints();
});