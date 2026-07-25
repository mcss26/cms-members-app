// cms-members.js
// Lógica para el módulo de Altas de Members y Cumpleaños

(async function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Guard de Autenticación
  // ─────────────────────────────────────────────────────────────────────────
  if (!window.Auth) {
    console.error("[cms-members] Auth module not loaded.");
    return;
  }

  const session = await window.Auth.guardOrRedirect([
    "cmxmr",
    "admin"
  ]);
  if (!session) return;

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Verificar Supabase
  // ─────────────────────────────────────────────────────────────────────────
  if (!window.Utils?.assertSbOrShowBlockingError?.()) {
    console.error("[cms-members] Supabase client not initialized.");
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Referencias DOM
  // ─────────────────────────────────────────────────────────────────────────
  const refs = {
    moduleContent: document.getElementById("module-content"),
    pageCardLoading: document.getElementById("page-card-loading"),
    pageCardEmpty: document.getElementById("page-card-empty"),
    statusPill: document.getElementById("cms-status-pill"),
    requestsList: document.getElementById("requestsList"),
    birthdayList: document.getElementById("birthdayList"),
    searchInput: document.getElementById("searchInput"),
    btnRefresh: document.getElementById("btnRefresh"),
    btnBulk: document.getElementById("btnBulk"),
    instaFrom: document.getElementById("instaFrom"),
    instaTo: document.getElementById("instaTo"),
    btnBulkBirthday: document.getElementById("btnBulkBirthday"),
    instaFromBirthday: document.getElementById("instaFromBirthday"),
    instaToBirthday: document.getElementById("instaToBirthday"),
    bulkFreeLink: document.getElementById("bulkFreeLink"),
    bulkPriorityLink: document.getElementById("bulkPriorityLink"),
    bulkTestEmail: document.getElementById("bulkTestEmail"),
    btnTestCampaign: document.getElementById("btnTestCampaign"),
    btnBulkCampaign: document.getElementById("btnBulkCampaign"),
    bulkProgressContainer: document.getElementById("bulk-progress-container"),
    bulkSentCount: document.getElementById("bulk-sent-count"),
    bulkProgressBar: document.getElementById("bulk-progress-bar"),
    scrollSentinel: document.getElementById("scroll-sentinel"),
    countTotal: document.getElementById("count-total"),
    countTotalPill: document.getElementById("count-total-pill"),
    countPendiente: document.getElementById("count-pendiente"),
    countPendienteMetric: document.getElementById("count-pendiente-metric"),
    countActivo: document.getElementById("count-activo"),
    countActivoPill: document.getElementById("count-activo-pill"),
    countRechazado: document.getElementById("count-rechazado"),
    countBanned: document.getElementById("count-banned"),

    countCumple: document.getElementById("count-cumple"),
    viewCampanas: document.getElementById("view-campanas"),
    viewConfig: document.getElementById("view-config"),
    configList: document.getElementById("configList"),
    birthdayToday: document.getElementById("birthday-today"),
    tabChips: document.querySelectorAll(".tab-chip"),
    filterPills: document.querySelectorAll(".pill[data-status]"),
    
    btnPrevPage: document.getElementById("btnPrevPage"),
    btnNextPage: document.getElementById("btnNextPage"),
    currentPageDisplay: document.getElementById("currentPageDisplay"),
    totalPagesDisplay: document.getElementById("totalPagesDisplay"),

    btnSortOrder: document.getElementById("btnSortOrder"),
    sortIcon: document.getElementById("sortIcon"),
    btnExportTotal: document.getElementById("btn-export-total"),
    btnExportActivos: document.getElementById("btn-export-activos"),
    
    // CSV Batch
    btnCsvCampaign: document.getElementById("btnCsvCampaign"),
    csvFreeLink: document.getElementById("csvFreeLink"),
    csvDropzone: document.getElementById("csv-dropzone"),
    csvFileInput: document.getElementById("csv-file-input"),
    csvFileName: document.getElementById("csv-file-name"),
    csvProgressContainer: document.getElementById("csv-progress-container"),
    csvSentCount: document.getElementById("csv-sent-count"),
    csvTotalCount: document.getElementById("csv-total-count"),
    csvProgressBar: document.getElementById("csv-progress-bar"),
  };

  const ui = { 
    loadingState: refs.pageCardLoading, 
    moduleContent: refs.moduleContent, 
    emptyState: refs.pageCardEmpty,
    btnLogout: document.getElementById("btn-logout")
  };

  // Safe Guard against critical missing DOM
  if (!refs.requestsList || !refs.moduleContent || !refs.searchInput) {
    console.warn('[cms-members] Missing critical DOM elements. The module might not render properly. Check HTML IDs.');
  }

  // Bind logout
  if (ui.btnLogout) {
    ui.btnLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.Auth.signOutAndGoLogin();
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Estado Local
  // ─────────────────────────────────────────────────────────────────────────
  const state = {
    members: [],
    currentFilter: "pendiente",
    currentView: "solicitudes",
    searchQuery: "",
    currentPage: 1,
    pageSize: 50,
    totalItems: 0,
    totalPages: 1,
    birthdayCount: 0,
    isLoadingMore: false,
    hasMore: true,
    sortDescending: true // true = más recientes primero, false = más antiguos primero
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Helpers de UI
  // ─────────────────────────────────────────────────────────────────────────


  function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (m) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[m];
    });
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }



  function hasCredsIssue(member, statusOverride) {
    const status = (statusOverride ?? member.status ?? "")
      .toString()
      .toLowerCase();
    if (status !== "activo") return false;
    const mid = member.member_id;
    if (!mid || mid === "null" || mid.length < 2) return true;
    // Ya no verificamos access_password porque ya no existe en DB
    return false;
  }

  function setText(ref, value) {
    if (ref) {
      if (window.Utils?.stopScramble) {
        window.Utils.stopScramble(ref, String(value ?? 0));
      } else {
        ref.textContent = String(value ?? 0);
      }
    }
  }

  function startCountScramble() {
    if (!window.Utils?.startScramble) return;
    const targets = [
      refs.countTotal, refs.countTotalPill, refs.countPendiente,
      refs.countPendienteMetric, refs.countActivo, refs.countActivoPill,
      refs.countRechazado, refs.countBanned
    ];
    targets.forEach(t => { if(t) window.Utils.startScramble(t); });
  }

  async function updateCounts() {
    startCountScramble();
    try {
      const getCount = (status) => window.sb.from('members').select('*', { count: 'exact', head: true }).eq('status', status);
      const [pend, actv, rech, bn, tot] = await Promise.all([
         getCount('pendiente'),
         getCount('active'),
         getCount('rechazado'),
         getCount('banned'),
         window.sb.from('members').select('*', { count: 'exact', head: true })
      ]);

      setText(refs.countTotal, tot.count || 0);
      setText(refs.countTotalPill, tot.count || 0);
      setText(refs.countPendiente, pend.count || 0);
      setText(refs.countPendienteMetric, pend.count || 0);
      setText(refs.countActivo, actv.count || 0);
      setText(refs.countActivoPill, actv.count || 0);
      setText(refs.countRechazado, rech.count || 0);
      setText(refs.countBanned, bn.count || 0);
    } catch(err) {
      console.warn("Error updating counts", err);
    }
  }

  function updateStatusPill() {
    if (!refs.statusPill) return;
    if (state.currentView === "cumple") {
      refs.statusPill.textContent = `CUMPLEAÑOS ${state.birthdayCount || 0}`;
    } else {
      refs.statusPill.textContent = `SOLICITUDES ${state.members.length || 0}`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Carga de Datos
  // ─────────────────────────────────────────────────────────────────────────
  async function loadMembers(page = parseInt(state.currentPage) || 1) {
    if (page < 1) page = 1;
    state.currentPage = page;

    if (state.isLoadingMore) return;
    state.isLoadingMore = true;

    window.Utils.setPageState(ui, { loading: true });
    state.members = [];
    if (refs.requestsList) refs.requestsList.innerHTML = '';

    try {
      let query = window.sb
          .from("members")
          .select("id, created_at, nombre, nacimiento, instagram, telefono, email, status, member_id", { count: 'exact' });

      // Si no es TODOS, agregamos eq
      if (state.currentFilter !== "all" && state.currentFilter !== "debug") {
          let dbStatus = state.currentFilter === "activo" ? "active" : state.currentFilter;
          query = query.eq('status', dbStatus);
      } else if (state.currentFilter === "debug") {
          query = query.eq('status', 'active').is('member_id', null);
      }

      if (state.searchQuery) {
          const sq = `%${state.searchQuery}%`;
          query = query.or(`nombre.ilike.${sq},instagram.ilike.${sq},email.ilike.${sq},telefono.ilike.${sq}`);
      }

      const from = (state.currentPage - 1) * state.pageSize;
      const to = from + state.pageSize - 1;

      const { data, count, error } = await query
          .order("created_at", { ascending: !state.sortDescending })
          .range(from, to);

      if (error) throw error;
      
      state.totalItems = count || 0;
      state.totalPages = Math.ceil(state.totalItems / state.pageSize) || 1;

      // Actualizar UI Paginación
      if (refs.currentPageDisplay) refs.currentPageDisplay.textContent = state.currentPage;
      if (refs.totalPagesDisplay) refs.totalPagesDisplay.textContent = state.totalPages;
      if (refs.btnPrevPage) refs.btnPrevPage.disabled = state.currentPage <= 1;
      if (refs.btnNextPage) refs.btnNextPage.disabled = state.currentPage >= state.totalPages;

      const newMembers = data.map((m) => {
        let status = (m.status || "pendiente").toString().toLowerCase();
        if (status === "active") status = "activo";
        const search = [m.nombre, m.instagram, m.email].filter(Boolean).join(" ").toLowerCase();
        return {
          ...m,
          _status: status,
          _search: search,
          _credsIssue: hasCredsIssue(m, status),
        };
      });

      state.members = newMembers;
      state.hasMore = (state.currentPage * state.pageSize) < state.totalItems;

      updateCounts();
      updateStatusPill();

      if (state.members.length === 0) {
        window.Utils.setPageState(ui, { empty: true });
        if (refs.requestsList) refs.requestsList.innerHTML = '<div class="empty-state">No hay resultados.</div>';
      } else {
        window.Utils.setPageState(ui, {});
        
        if (refs.requestsList) {
           const pageOffset = (state.currentPage - 1) * state.pageSize;
           const html = newMembers.map((m, i) => renderMemberCard(m, pageOffset + i)).join("");
           refs.requestsList.innerHTML = html;
        }
      }

    } catch (err) {
      console.error("[cms-members] Error cargando members:", err);
      if (window.Toast) window.Toast.error("Error al cargar datos: " + err.message);
      if (refs.requestsList) {
        refs.requestsList.innerHTML =
          '<div class="empty-state danger">Error al cargar datos. Contáctate con soporte.</div>';
      }
      if (window.Utils) window.Utils.setPageState(ui, {});
    } finally {
      state.isLoadingMore = false;
      if (window.Utils) window.Utils.setPageState(ui, { loading: false });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Renderizado
  // ─────────────────────────────────────────────────────────────────────────
    // renderList has been deleted as it is no longer used due to Server-Side Rendering.

  function renderMemberCard(m, index) {
    const status = (m._status || "pendiente").toLowerCase();
    const avatarNumber = index + 1;

    let dotClass = "dot-warning";
    if (status === "activo") dotClass = "dot-success";
    if (status === "rechazado" || status === "banned") dotClass = "dot-error";

    const igHandle = (m.instagram || "").replace("@", "").trim();
    const igLink = igHandle
      ? `<a href="https://instagram.com/${encodeURIComponent(igHandle)}" target="_blank" class="ig-link">${escapeHTML("@" + igHandle)}</a>`
      : `<span class="faint">Sin IG</span>`;

    const credsIssue = m._credsIssue;

    let actionsHtml = "";

    if (status !== "activo") {
      actionsHtml += `<button class="btn-icon-svg accent-green" data-action="approve" data-id="${m.id}" title="Aprobar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>`;
    }

    if (status !== "rechazado") {
      actionsHtml += `<button class="btn-icon-svg accent-red" data-action="reject" data-id="${m.id}" title="Rechazar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
    }

    if (status === "activo") {
      actionsHtml += `<button class="btn-ghost btn-sm" data-action="resend" data-id="${m.id}">RESEND</button>`;
    }

    return `
        <div class="staff-row" role="listitem" data-global-index="${index + 1}" data-instagram="${escapeHTML(igHandle)}" data-member-id="${m.id}" data-status="${status}" data-search="${escapeHTML(m._search || "")}" style="--stagger: ${index % 20}">
            <div class="avatar-circle" style="font-family: var(--font-mono); font-size: 11px;">${avatarNumber}</div>
            <div class="staff-info" style="flex: 1">
                <div class="row-flex gap-8 align-center">
                    <span class="staff-name text-primary">${escapeHTML(m.nombre || "Sin Nombre")}</span>
                    <span class="status-dot ${dotClass}" title="${status.toUpperCase()}"></span>
                    ${credsIssue ? '<span class="status-dot dot-error" title="ERR CREDS"></span>' : ""}
                </div>
                
                <div class="row-flex gap-8 mt-4 text-xs font-mono">
                    <span>${igLink}</span>
                    <span class="faint">•</span>
                    <span class="muted">${escapeHTML(m.email || "No email")}</span>
                    <span class="faint">•</span>
                    <span class="muted">${escapeHTML(m.telefono || "Sin Teléfono")}</span>
                    ${m.member_id ? `<span class="faint">•</span> <span class="accent">${escapeHTML(m.member_id)}</span>` : ""}
                </div>
            </div>

            <div class="staff-actions row-flex gap-8">
                ${actionsHtml}
            </div>
        </div>
        `;
  }

  async function loadBirthdays() {
    if (!refs.birthdayList) return;
    
    // Scramble the KPIs for birthdays (the top servers/metrics for this view)
    if (window.Utils?.startScramble) {
        window.Utils.startScramble(refs.birthdayToday);
        window.Utils.startScramble(refs.countCumple);
    }
    
    window.Utils.setPageState(ui, { loading: true });

    try {
      const today = new Date();
      const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const startMonday = new Date(today);
      startMonday.setDate(today.getDate() - daysToMonday);

      const orConditions = [];
      const todayDay = today.getDate();
      const todayMonth = today.getMonth() + 1;
      
      const todayMatchStrings = [
         `${todayDay}/${todayMonth}/`,
         `${String(todayDay).padStart(2, "0")}/${todayMonth}/`,
         `${todayDay}/${String(todayMonth).padStart(2, "0")}/`,
         `${String(todayDay).padStart(2, "0")}/${String(todayMonth).padStart(2, "0")}/`
      ];

      for (let i = 0; i < 7; i++) {
         const d = new Date(startMonday);
         d.setDate(startMonday.getDate() + i);
         const dDay = d.getDate();
         const dMonth = d.getMonth() + 1;

         orConditions.push(`nacimiento.ilike.${dDay}/${dMonth}/%`);
         orConditions.push(`nacimiento.ilike.${String(dDay).padStart(2, "0")}/${dMonth}/%`);
         orConditions.push(`nacimiento.ilike.${dDay}/${String(dMonth).padStart(2, "0")}/%`);
         orConditions.push(`nacimiento.ilike.${String(dDay).padStart(2, "0")}/${String(dMonth).padStart(2, "0")}/%`);
      }

      const orString = orConditions.join(',');

      const { data, error } = await window.sb
         .from("members")
         .select("id, nombre, nacimiento, instagram, telefono, email, status")
         .eq("status", "active")
         .or(orString);

      if (error) throw error;

      let countToday = 0;
      let countWeek = data ? data.length : 0;

      const filteredData = (data || []).map(m => {
          let isToday = false;
          if (m.nacimiento) {
              const bMatch = todayMatchStrings.some(ts => m.nacimiento.startsWith(ts));
              if (bMatch) {
                  isToday = true;
                  countToday++;
              }
          }
          return { ...m, isToday };
      });

      function getDaysSinceStart(nac) {
          if (!nac) return 99;
          const parts = nac.split('/');
          if (parts.length < 2) return 99;
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          
          for (let i = 0; i < 7; i++) {
              const testDate = new Date(startMonday);
              testDate.setDate(startMonday.getDate() + i);
              if (testDate.getDate() === d && (testDate.getMonth() + 1) === m) {
                  return i;
              }
          }
          return 99;
      }

      filteredData.sort((a, b) => getDaysSinceStart(a.nacimiento) - getDaysSinceStart(b.nacimiento));

      state.birthdayCount = countWeek;
      state.members = filteredData;
      
      setText(refs.birthdayToday, countToday);
      setText(refs.countCumple, countWeek);
      updateStatusPill();

      window.Utils.setPageState(ui, {});

      if (filteredData.length === 0) {
        refs.birthdayList.innerHTML = `<div class="empty-state">
                  <p>No hay cumpleaños en la semana (de lunes a domingo).</p>
              </div>`;
        return;
      }

      refs.birthdayList.innerHTML = filteredData
        .map((m, index) => renderBirthdayCard(m, index))
        .join("");

    } catch (err) {
      console.error("[cms-members] Error cargando cumpleaños:", err);
      if (window.Toast) window.Toast.error("Error cargando cumpleaños");
    } finally {
       window.Utils.setPageState(ui, { loading: false });
    }
  }

  function renderBirthdayCard(m, index) {
    const igHandle = (m.instagram || "").replace("@", "").trim();
    const igLink = igHandle
      ? `<a href="https://instagram.com/${encodeURIComponent(igHandle)}" target="_blank" class="accent">@${escapeHTML(igHandle)}</a>`
      : `<span class="faint">Sin IG</span>`;

    const tagHtml = m.isToday 
      ? `<span class="status-pill status-success" style="border: 1px solid var(--green-400); color: var(--green-400); font-weight: bold; padding: 4px 8px; font-size: 10px;">HOY</span>`
      : `<span class="status-pill status-neutral" style="border: 1px solid var(--neutral-600); color: var(--neutral-400); padding: 4px 8px; font-size: 10px;">${escapeHTML(m.nacimiento)}</span>`;

    return `
        <div class="staff-row" role="listitem" data-member-id="${m.id}" data-global-index="${index + 1}" data-instagram="${escapeHTML(igHandle)}" ${m.isToday ? 'style="border-left: 2px solid var(--green-400);"' : ''}>
            <div class="avatar-circle" style="font-family: var(--font-mono); font-size: 11px;">${index + 1}</div>
            <div class="staff-info">
                <div class="row-flex gap-8 align-center">
                    <span class="staff-name" ${m.isToday ? 'style="color: var(--green-400);"' : ''}>${escapeHTML(m.nombre)}</span>
                    ${tagHtml}
                </div>
                
                <div class="row-flex gap-16 mt-4 text-sm">
                     <span>${igLink}</span>
                     <span class="muted">${escapeHTML(m.email || "")}</span>
                     <span class="faint">•</span>
                     <span class="muted font-mono" style="font-size: 12px;">${escapeHTML(m.telefono || "Sin Teléfono")}</span>
                </div>
            </div>

            <div class="staff-actions">
                <button class="btn-primary btn-sm" data-action="whatsapp" data-id="${m.id}" style="background-color: #25D366; border-color: #25D366; color: white; display: inline-flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    WHATSAPP
                </button>
            </div>
        </div>
        `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Acciones
  // ─────────────────────────────────────────────────────────────────────────
  async function processAction(action, memberId) {
    const member = state.members.find((m) => String(m.id) === String(memberId));
    if (!member) return;

    let confirmMsg = "";
    if (action === "approve")
      confirmMsg = `¿Aprobar a ${member.nombre} y enviar credenciales?`;
    if (action === "reject")
      confirmMsg = `¿Rechazar solicitud de ${member.nombre}?`;
    if (action === "resend")
      confirmMsg = `¿Regenerar credenciales y reenviar mail a ${member.nombre}?`;

    const confirmed = await window.Utils.confirmModal(confirmMsg);
    if (!confirmed) return;

    const authFnUrl = `${window.APP_CONFIG.SUPABASE_URL}/functions/v1/auth-member`;

    // APPROVE / RESEND: Usar Edge Function (genera password, hashea, envía email)
    if (action === "approve" || action === "resend") {
      try {
        const actionLabel = action === "resend" ? "Reenviando credenciales..." : "Procesando aprobación...";
        window.Toast.info(actionLabel);

        // Llamar Edge Function
        const resp = await fetch(authFnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": window.APP_CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: "approve",
            id: memberId
          })
        });

        const result = await resp.json();

        if (!resp.ok || !result.success) {
          throw new Error(result.error || "Error al procesar miembro");
        }

        // Mostrar credenciales como fallback (por si el email falla)
        if (result.credentials) {
          const title = action === "resend" ? "Credenciales Regeneradas" : "Credenciales Generadas";
          const msg = `✅ MIEMBRO ${action === "resend" ? "ACTUALIZADO" : "APROBADO"}\n\nID: ${result.credentials.member_id}\nPASS: ${result.credentials.password}\n\nURL: midnightclub.com.ar\n\n${result.warning ? '⚠️ ' + result.warning : 'Email enviado correctamente'}\n\n(Copia estos datos por seguridad)`;
          await window.Utils.alertModal(msg, title);
        }

        if (result.warning) {
          window.Toast.warning(result.warning);
        } else {
          const successMsg = action === "resend" ? "Credenciales regeneradas y email enviado" : "Miembro aprobado y email enviado";
          window.Toast.success(successMsg);
        }

        if (action === "resend" || state.currentFilter === "all" || state.currentFilter === "debug") {
           await loadMembers();
        } else {
           const row = document.querySelector(`.staff-row[data-member-id="${memberId}"]`);
           if (row) {
              row.classList.add('is-exiting');
              setTimeout(() => {
                 row.remove();
                 updateCounts();
                 if (document.querySelectorAll('.staff-row:not(.is-exiting)').length === 0) {
                     loadMembers();
                 }
              }, 500);
           } else {
              await loadMembers();
           }
        }
        return;
      } catch (err) {
        console.error(`Error en ${action}:`, err);
        window.Toast.error("Error: " + err.message);
        return;
      }
    }

    // REJECT: Solo actualizar status en DB
    if (action === "reject") {
      try {
        const { error } = await window.sb
            .from("members")
            .update({ status: "rechazado" })
            .eq("id", memberId);

        if (error) throw error;

        window.Toast.success("Solicitud rechazada");
        
        if (state.currentFilter === "all" || state.currentFilter === "debug") {
            await loadMembers();
        } else {
            const row = document.querySelector(`.staff-row[data-member-id="${memberId}"]`);
            if (row) {
                row.classList.add('is-exiting');
                setTimeout(() => {
                    row.remove();
                    updateCounts();
                    if (document.querySelectorAll('.staff-row:not(.is-exiting)').length === 0) {
                        loadMembers();
                    }
                }, 500);
            } else {
                await loadMembers();
            }
        }
        return;
      } catch (err) {
        console.error("Error al rechazar:", err);
        window.Toast.error("Error: " + err.message);
        return;
      }
    }
  }

  function sendWhatsAppGreeting(memberId) {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;

    if (!member.telefono) {
      if (window.Toast) window.Toast.warning("Este miembro no tiene un teléfono registrado.");
      return;
    }

    let phone = member.telefono.replace(/\D/g, "");
    if (!phone.startsWith("54")) {
      if (phone.startsWith("11") || phone.startsWith("15") || phone.length === 10) {
        phone = "549" + phone;
      } else {
        phone = "54" + phone;
      }
    }

    const firstName = member.nombre ? member.nombre.trim().split(/\s+/)[0] : "Miembro";
    const message = `¡Hola ${firstName}! 🎂🎊 Como esta semana es tu cumpleaños, en Midnight Club queremos festejarlo como se debe 🍾🔥\n\nTe esperamos este finde con 5 SHOTS de cortesía para que brindes con tus amigos 🥂✨\n\n👉 Para reclamarlos responde a este mensaje y luego simplemente acercate a la Caja 1 con tu nombre, ¡y listo!\n\n¡Que tengas un excelente día y nos vemos el Sábado!`;
    const url = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  }

  function openBulkInstagrams() {
    const fromVal = parseInt(refs.instaFrom?.value || "0");
    const toVal = parseInt(refs.instaTo?.value || "0");

    if (!fromVal || !toVal || toVal < fromVal) {
      if (window.Toast) window.Toast.warning("Rango inválido");
      return;
    }

    const rows = refs.requestsList?.querySelectorAll(".staff-row:not(.hidden)") || [];
    const slice = Array.from(rows).filter(row => {
      const idx = parseInt(row.dataset.globalIndex);
      return idx >= fromVal && idx <= toVal;
    });

    let handles = [];
    slice.forEach((row) => {
      const handle = row.dataset.instagram;
      if (handle) handles.push(handle);
    });

    if (handles.length === 0) {
      if (window.Toast) window.Toast.info("No hay usuarios con IG en ese rango");
      return;
    }

    handles.forEach(handle => {
      window.open(`https://instagram.com/${encodeURIComponent(handle)}`, "_blank");
    });

    if (window.Toast) {
      window.Toast.success(`Abriendo ${handles.length} perfiles. Recuerda permitir ventanas emergentes (pop-ups) en tu navegador.`);
    }
  }

  function openBulkBirthdaysInstagrams() {
    const fromVal = parseInt(refs.instaFromBirthday?.value || "0");
    const toVal = parseInt(refs.instaToBirthday?.value || "0");

    if (!fromVal || !toVal || toVal < fromVal) {
      if (window.Toast) window.Toast.warning("Rango inválido");
      return;
    }

    const rows = refs.birthdayList?.querySelectorAll(".staff-row:not(.hidden)") || [];
    const slice = Array.from(rows).filter(row => {
      const idx = parseInt(row.dataset.globalIndex);
      return idx >= fromVal && idx <= toVal;
    });

    let handles = [];
    slice.forEach((row) => {
      const handle = row.dataset.instagram;
      if (handle) handles.push(handle);
    });

    if (handles.length === 0) {
      if (window.Toast) window.Toast.info("No hay usuarios con IG en ese rango");
      return;
    }

    handles.forEach(handle => {
      window.open(`https://instagram.com/${encodeURIComponent(handle)}`, "_blank");
    });

    if (window.Toast) {
      window.Toast.success(`Abriendo ${handles.length} perfiles. Recuerda permitir ventanas emergentes (pop-ups) en tu navegador.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BULK EMAIL LOGIC
  // ─────────────────────────────────────────────────────────────────────────
  async function callBulkEmailFn(payload) {
    const authFnUrl = `${window.APP_CONFIG.SUPABASE_URL}/functions/v1/bulk-email-active`;
    const resp = await fetch(authFnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": window.APP_CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const result = await resp.json();
    if (!resp.ok || !result.success) {
      const details = result.details ? ` (${result.details})` : "";
      throw new Error((result.error || "Error en el envío") + details);
    }
    return result;
  }

  async function executeTestCampaign() {
    const freeLink = refs.bulkFreeLink?.value.trim();
    const priorityLink = refs.bulkPriorityLink?.value.trim();
    const testEmail = refs.bulkTestEmail?.value.trim();

    if (!freeLink || !priorityLink) {
      if (window.Toast) window.Toast.warning("Faltan los links de la campaña");
      return;
    }
    if (!testEmail) {
      if (window.Toast) window.Toast.warning("Falta el email de prueba");
      return;
    }

    try {
      if (window.Toast) window.Toast.info("Enviando prueba...");
      await callBulkEmailFn({
        isTest: true,
        testEmail: testEmail,
        freeLink: freeLink,
        priorityLink: priorityLink
      });
      if (window.Toast) window.Toast.success("Email de prueba enviado exitosamente.");
    } catch (err) {
      console.error("Test Campaign Error:", err);
      if (window.Toast) window.Toast.error("Error: " + err.message);
    }
  }

  async function executeBulkCampaign() {
    const freeLink = refs.bulkFreeLink?.value.trim();
    const priorityLink = refs.bulkPriorityLink?.value.trim();

    if (!freeLink || !priorityLink) {
      if (window.Toast) window.Toast.warning("Faltan los links de la campaña");
      return;
    }

    // Get total active from the DOM (assuming it's in countActivo or countTotal for this view)
    const totalActiveStr = refs.countActivo?.textContent || "0";
    const totalActive = parseInt(totalActiveStr.replace(/\D/g, ''), 10);
    
    if (totalActive === 0) {
      if (window.Toast) window.Toast.warning("No hay miembros activos para enviar.");
      return;
    }

    const confirmMsg = `¿Estás seguro de enviar la campaña de email a TODOS los miembros activos (aprox ${totalActive})?`;
    const confirmed = await window.Utils.confirmModal(confirmMsg);
    if (!confirmed) return;

    if (refs.bulkProgressContainer) refs.bulkProgressContainer.style.display = "block";
    if (refs.btnBulkCampaign) refs.btnBulkCampaign.disabled = true;
    if (refs.bulkSentCount) refs.bulkSentCount.textContent = "0";
    if (refs.bulkProgressBar) refs.bulkProgressBar.style.width = "0%";

    let hasMore = true;
    let lastId = '00000000-0000-0000-0000-000000000000';
    let totalSent = 0;

    try {
      if (window.Toast) window.Toast.info("Iniciando envío masivo...");
      
      while (hasMore) {
        const result = await callBulkEmailFn({
          isTest: false,
          freeLink: freeLink,
          priorityLink: priorityLink,
          last_id: lastId
        });
        
        const sent = result.sentCount || 0;
        const processed = result.processedCount || sent;
        totalSent += sent;
        
        if (refs.bulkSentCount) refs.bulkSentCount.textContent = String(totalSent);
        if (refs.bulkProgressBar) {
           const pct = totalActive > 0 ? Math.min(100, (totalSent / totalActive) * 100) : 100;
           refs.bulkProgressBar.style.width = `${pct}%`;
        }

        if (processed < 100 || !result.next_last_id) {
          hasMore = false;
        } else {
          lastId = result.next_last_id;
          // Pause 2 seconds to respect Resend Rate Limits
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      if (window.Toast) window.Toast.success(`Campaña finalizada. Se enviaron ${totalSent} correos.`);
    } catch (err) {
      console.error("Bulk Campaign Error:", err);
      window.Utils.alertModal(`El envío se detuvo por un error.\nSe enviaron ${totalSent} correos.\nError: ${err.message}`, "Error en Envío Masivo");
    } finally {
      if (refs.btnBulkCampaign) refs.btnBulkCampaign.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8.5 CSV Bulk Campaign
  // ─────────────────────────────────────────────────────────────────────────
  let csvContacts = [];

  function handleCsvFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      if (window.Toast) window.Toast.error("Por favor, sube un archivo CSV válido.");
      return;
    }
    
    if (refs.csvFileName) {
       refs.csvFileName.textContent = `Archivo cargado: ${file.name}`;
       refs.csvFileName.style.display = 'block';
       refs.csvDropzone.style.display = 'none';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      
      csvContacts = [];
      for (let i = 1; i < lines.length; i++) { // Saltamos la cabecera
        const parts = lines[i].split(/[,;]/);
        if (parts.length >= 2) {
          const nombre = parts[0].replace(/"/g, "").trim();
          const email = parts[1].replace(/"/g, "").trim();
          if (nombre && email && email.includes('@')) {
            csvContacts.push({ nombre, email });
          }
        }
      }
      
      if (refs.csvTotalCount) refs.csvTotalCount.textContent = csvContacts.length;
      if (refs.btnCsvCampaign && csvContacts.length > 0) {
         refs.btnCsvCampaign.disabled = false;
         refs.btnCsvCampaign.textContent = `ENVIAR A ${csvContacts.length} CONTACTOS`;
      }
    };
    reader.readAsText(file);
  }

  if (refs.csvDropzone && refs.csvFileInput) {
    refs.csvDropzone.addEventListener("click", () => refs.csvFileInput.click());
    
    refs.csvDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      refs.csvDropzone.style.borderColor = "var(--text-primary)";
      refs.csvDropzone.style.color = "var(--text-primary)";
    });

    refs.csvDropzone.addEventListener("dragleave", () => {
      refs.csvDropzone.style.borderColor = "var(--neutral-600)";
      refs.csvDropzone.style.color = "var(--neutral-400)";
    });

    refs.csvDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      refs.csvDropzone.style.borderColor = "var(--neutral-600)";
      refs.csvDropzone.style.color = "var(--neutral-400)";
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        refs.csvFileInput.files = e.dataTransfer.files;
        handleCsvFile(e.dataTransfer.files[0]);
      }
    });

    refs.csvFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleCsvFile(e.target.files[0]);
      }
    });
  }

  async function callBulkCsvEmailFn(payload) {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) throw new Error("No hay sesión activa");
    
    // Obtenemos la URL de las funciones directamente de window.APP_CONFIG.SUPABASE_URL
    const url = `${window.APP_CONFIG.SUPABASE_URL}/functions/v1/bulk-email-csv`;
    
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": window.APP_CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
    
    const result = await resp.json();
    if (!resp.ok || !result.success) {
      const details = result.details ? ` (${result.details})` : "";
      throw new Error((result.error || "Error en el envío") + details);
    }
    return result;
  }

  async function executeCsvCampaign() {
    const freeLink = refs.csvFreeLink?.value.trim();
    if (!freeLink) {
      if (window.Toast) window.Toast.warning("Falta el link de la campaña FREE PASS");
      return;
    }
    if (csvContacts.length === 0) {
      if (window.Toast) window.Toast.warning("No hay contactos válidos cargados en el CSV");
      return;
    }

    const confirmMsg = `¿Estás seguro de enviar la campaña a los ${csvContacts.length} contactos del CSV?`;
    const confirmed = await window.Utils.confirmModal(confirmMsg);
    if (!confirmed) return;

    if (refs.csvProgressContainer) refs.csvProgressContainer.style.display = "block";
    if (refs.btnCsvCampaign) refs.btnCsvCampaign.disabled = true;
    if (refs.csvSentCount) refs.csvSentCount.textContent = "0";
    if (refs.csvProgressBar) refs.csvProgressBar.style.width = "0%";

    let totalSent = 0;
    const batchSize = 100;

    try {
      if (window.Toast) window.Toast.info("Iniciando envío masivo por CSV...");
      
      for (let i = 0; i < csvContacts.length; i += batchSize) {
        const batch = csvContacts.slice(i, i + batchSize);
        
        const result = await callBulkCsvEmailFn({
          freeLink: freeLink,
          contacts: batch
        });
        
        const sent = result.sentCount || 0;
        totalSent += sent;
        
        if (refs.csvSentCount) refs.csvSentCount.textContent = String(totalSent);
        if (refs.csvProgressBar) {
           const pct = Math.min(100, (totalSent / csvContacts.length) * 100);
           refs.csvProgressBar.style.width = `${pct}%`;
        }
        
        if (i + batchSize < csvContacts.length) {
          // Pause 2 seconds to respect Resend Rate Limits
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      if (window.Toast) window.Toast.success(`Campaña CSV finalizada. Se enviaron ${totalSent} correos.`);
    } catch (err) {
      console.error("Bulk CSV Campaign Error:", err);
      window.Utils.alertModal(`El envío se detuvo por un error.\nSe procesaron ${totalSent} correos.\nError: ${err.message}`, "Error en Envío Masivo CSV");
    } finally {
      if (refs.btnCsvCampaign) refs.btnCsvCampaign.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Vista Switching
  // ─────────────────────────────────────────────────────────────────────────
  function switchView(viewName) {
    state.currentView = viewName;

    refs.tabChips.forEach((t) => {
      t.classList.toggle("active", t.dataset.view === viewName);
    });

    document.querySelectorAll(".view-container").forEach((el) => {
      el.classList.add("hidden");
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove("hidden");

    if (viewName === "solicitudes") {
      loadMembers(1);
    } else if (viewName === "cumple") {
      loadBirthdays();
    } else if (viewName === "config") {
      loadSiteConfig();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Event Listeners
  // ─────────────────────────────────────────────────────────────────────────

  // Tab switching
  refs.tabChips.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  // Filter pills
  refs.filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      refs.filterPills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      state.currentFilter = pill.dataset.status || "pendiente";
      loadMembers(1);
    });
  });

  // Search with debounce
  let searchTimeout;
  refs.searchInput?.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      state.searchQuery = e.target.value.trim();
      searchTimeout = setTimeout(() => {
        loadMembers(1);
      }, 500);
  });

  // Refresh
  refs.btnRefresh?.addEventListener("click", () => {
    if (state.currentView === "cumple") loadBirthdays();
    else loadMembers(1);
  });

  // Pagination listeners
  refs.btnPrevPage?.addEventListener("click", () => {
    if (state.currentPage > 1) {
      loadMembers(state.currentPage - 1);
    }
  });

  refs.btnNextPage?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      loadMembers(state.currentPage + 1);
    }
  });

  // Sort toggle
  refs.btnSortOrder?.addEventListener("click", () => {
    state.sortDescending = !state.sortDescending;
    
    // Update Icon & Title
    if (refs.sortIcon) {
      if (state.sortDescending) {
        // Down arrow (newest first)
        refs.sortIcon.innerHTML = `<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>`;
        refs.btnSortOrder.title = "Invertir orden (Más recientes primero)";
      } else {
        // Up arrow (oldest first)
        refs.sortIcon.innerHTML = `<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>`;
        refs.btnSortOrder.title = "Invertir orden (Más antiguos primero)";
      }
    }
    
    loadMembers(1);
  });

  // Bulk Instagram
  refs.btnBulk?.addEventListener("click", openBulkInstagrams);
  refs.btnBulkBirthday?.addEventListener("click", openBulkBirthdaysInstagrams);

  // Bulk Email
  refs.btnTestCampaign?.addEventListener("click", executeTestCampaign);
  refs.btnBulkCampaign?.addEventListener("click", executeBulkCampaign);
  refs.btnCsvCampaign?.addEventListener("click", executeCsvCampaign);

  // CSV Export
  async function downloadMembersCSV(type) {
    if (window.Toast) window.Toast.info(`Generando CSV de ${type}... esto puede tardar un momento.`);
    try {
      let allData = [];
      let from = 0;
      const limit = 1000;
      
      while (true) {
        let query = window.sb.from('members').select('nombre, email');
        if (type === 'activos') {
          query = query.eq('status', 'active');
        }
        
        const { data, error } = await query.range(from, from + limit - 1);
        if (error) throw error;
        
        if (!data || data.length === 0) break;
        
        allData = allData.concat(data);
        
        if (data.length < limit) break;
        from += limit;
      }

      if (allData.length === 0) {
        if (window.Toast) window.Toast.info("No hay datos para exportar.");
        return;
      }
      
      let csvContent = "NOMBRE,EMAIL\n";
      allData.forEach(row => {
        const nombre = (row.nombre || "").replace(/,/g, "").trim();
        const email = (row.email || "").replace(/,/g, "").trim();
        csvContent += `${nombre},${email}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `miembros_${type}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (window.Toast) window.Toast.success(`CSV descargado exitosamente (${allData.length} registros)`);
    } catch(err) {
      console.error("[cms-members] Error exportando CSV:", err);
      if (window.Toast) window.Toast.error("Error al exportar CSV");
    }
  }

  refs.btnExportTotal?.addEventListener("click", () => downloadMembersCSV('totales'));
  refs.btnExportActivos?.addEventListener("click", () => downloadMembersCSV('activos'));

  // Delegated click handler for actions
  document.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;
    
    e.preventDefault();

    const action = actionBtn.dataset.action;
    const memberId = actionBtn.dataset.id;

    if (action === "whatsapp") {
      sendWhatsAppGreeting(memberId);
    } else if (action === "toggle-config") {
      const currentState = actionBtn.dataset.active === "true";
      toggleSiteConfig(memberId, currentState);
    } else if (action === "save-config") {
      const name = document.getElementById(`cfg_name_${memberId}`)?.value || "";
      const desc = document.getElementById(`cfg_desc_${memberId}`)?.value || "";
      const url = document.getElementById(`cfg_url_${memberId}`)?.value || "";
      updateSiteConfigData(memberId, actionBtn, name, desc, url);
    } else {
      processAction(action, memberId);
    }
  });


  // ─────────────────────────────────────────────────────────────────────────
  // 10. Site Config
  // ─────────────────────────────────────────────────────────────────────────
  async function loadSiteConfig() {
    if (!refs.configList) return;
    window.Utils.setPageState(ui, { loading: true });
    try {
      const { data, error } = await window.sb
        .from('site_config')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        refs.configList.innerHTML = '<div class="empty-state">No hay configuraciones.</div>';
      } else {
        refs.configList.innerHTML = data.map((c, i) => renderConfigCard(c, i)).join('');
      }
    } catch (err) {
      console.error("[cms-members] Error cargando site_config:", err);
      if (window.Toast) window.Toast.error("Error al cargar configuraciones");
    } finally {
      window.Utils.setPageState(ui, { loading: false });
    }
  }

  function renderConfigCard(c, index) {
    const isActive = c.is_active === true;
    const switchClass = isActive ? "toggle-switch active" : "toggle-switch";
    const dotClass = isActive ? "dot-success" : "dot-neutral";

    return `
        <div class="staff-row cms-config-card" role="listitem" data-global-index="${index + 1}" style="--stagger: ${index % 10};">
            
            <div class="cms-config-header row-flex align-center justify-between">
                <div class="text-xs font-mono faint">#${index + 1} &mdash; ${escapeHTML(c.key)}</div>
                <div class="row-flex align-center gap-8">
                  <span class="status-dot ${dotClass}" title="${isActive ? 'ACTIVO' : 'INACTIVO'}"></span>
                  <div class="${switchClass}" data-action="toggle-config" data-id="${c.id}" data-active="${isActive}" role="switch" aria-checked="${isActive}" tabindex="0">
                    <div></div>
                  </div>
                </div>
            </div>

            <div class="cms-config-body">
                <div class="input-wrap">
                    <label for="cfg_name_${c.id}" class="text-xs font-mono text-primary">NOMBRE</label>
                    <input type="text" id="cfg_name_${c.id}" class="input input-compact cms-config-input" value="${escapeHTML(c.name || "")}">
                </div>

                <div class="input-wrap">
                    <label for="cfg_desc_${c.id}" class="text-xs font-mono text-primary">DESCRIPCIÓN</label>
                    <textarea id="cfg_desc_${c.id}" class="input input-compact cms-config-input" rows="2">${escapeHTML(c.description || "")}</textarea>
                </div>

                <div class="input-wrap">
                    <label for="cfg_url_${c.id}" class="text-xs font-mono text-primary">URL</label>
                    <input type="text" id="cfg_url_${c.id}" class="input input-compact cms-config-input accent" value="${escapeHTML(c.url || "")}">
                </div>
            </div>

            <div class="cms-config-footer row-flex align-center justify-end">
                <button class="btn-secondary btn-sm" data-action="save-config" data-id="${c.id}">GUARDAR</button>
            </div>
        </div>
    `;
  }

  async function toggleSiteConfig(id, currentState) {
    try {
      const newState = !currentState;
      // Optimistic update in UI
      const toggleBtn = document.querySelector(`[data-action="toggle-config"][data-id="${id}"]`);
      if (toggleBtn) {
        toggleBtn.dataset.active = newState;
        toggleBtn.setAttribute('aria-checked', newState);
        if (newState) {
          toggleBtn.classList.add('active');
        } else {
          toggleBtn.classList.remove('active');
        }
        const dotNode = toggleBtn.closest('.cms-config-card').querySelector('.status-dot');
        if (dotNode) {
          dotNode.className = `status-dot ${newState ? 'dot-success' : 'dot-neutral'}`;
          dotNode.title = newState ? 'ACTIVO' : 'INACTIVO';
        }
      }

      const { error } = await window.sb
        .from('site_config')
        .update({ is_active: newState })
        .eq('id', id);

      if (error) throw error;
      if (window.Toast) window.Toast.success("Configuración actualizada");
    } catch (err) {
      console.error("Error updating site_config:", err);
      if (window.Toast) window.Toast.error("Error al actualizar configuración");
      loadSiteConfig(); // Revert on error
    }
  }

  async function updateSiteConfigData(id, btn, name, desc, url) {
    const originalText = btn.textContent;
    btn.textContent = "GUARDANDO...";
    btn.disabled = true;
    
    try {
      const { error } = await window.sb
        .from('site_config')
        .update({ 
           name: name,
           description: desc,
           url: url
        })
        .eq('id', id);

      if (error) throw error;
      if (window.Toast) window.Toast.success("Datos guardados correctamente");
    } catch (err) {
      console.error("Error saving site_config data:", err);
      if (window.Toast) window.Toast.error("Error al guardar: " + err.message);
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Inicialización
  // ─────────────────────────────────────────────────────────────────────────
  await loadMembers();
})();
