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
    birthdayToday: document.getElementById("birthday-today"),
    tabs: document.querySelectorAll(".tab-chip[data-view]"),
    filterPills: document.querySelectorAll(".pill[data-status]"),
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
    birthdayCount: 0,
    isLoadingMore: false,
    hasMore: true
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
    if (ref) ref.textContent = String(value ?? 0);
  }

  async function updateCounts() {
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
  async function loadMembers(page = parseInt(state.currentPage) || 1, append = false) {
    if (page < 1) page = 1;
    state.currentPage = page;

    if (state.isLoadingMore) return;
    state.isLoadingMore = true;

    if (!append) {
      window.Utils.setPageState(ui, { loading: true });
      state.members = [];
      if (refs.requestsList) refs.requestsList.innerHTML = '';
      if (refs.scrollSentinel) refs.scrollSentinel.classList.add("hidden");
    } else {
      if (refs.scrollSentinel) {
         refs.scrollSentinel.classList.remove("hidden");
         refs.scrollSentinel.textContent = "↓ CARGANDO MÁS ↓";
      }
    }

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
          query = query.or(`nombre.ilike.${sq},instagram.ilike.${sq},email.ilike.${sq}`);
      }

      const from = (state.currentPage - 1) * state.pageSize;
      const to = from + state.pageSize - 1;

      const { data, count, error } = await query
          .order("created_at", { ascending: false })
          .range(from, to);

      if (error) throw error;
      
      if (!append) {
          state.totalItems = count || 0;
      }

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

      if (!append) {
         state.members = newMembers;
      } else {
         state.members = state.members.concat(newMembers);
      }

      state.hasMore = (state.currentPage * state.pageSize) < state.totalItems;

      updateCounts();
      updateStatusPill();

      if (state.members.length === 0) {
        window.Utils.setPageState(ui, { empty: true });
        if (refs.requestsList) refs.requestsList.innerHTML = '<div class="empty-state">No hay resultados.</div>';
      } else {
        if (!append) window.Utils.setPageState(ui, {});
        
        if (refs.requestsList) {
           const html = newMembers.map((m, i) => renderMemberCard(m, (append ? (page-1)*state.pageSize : 0) + i)).join("");
           if (!append) {
               refs.requestsList.innerHTML = html;
           } else {
               refs.requestsList.insertAdjacentHTML('beforeend', html);
           }
        }
      }

      if (refs.scrollSentinel) {
         if (!state.hasMore && state.members.length > 0) {
            refs.scrollSentinel.classList.add("hidden");
         } else if (state.members.length > 0) {
            refs.scrollSentinel.classList.remove("hidden");
            refs.scrollSentinel.textContent = "↓ CARGANDO MÁS ↓";
         } else {
            refs.scrollSentinel.classList.add("hidden");
         }
      }

    } catch (err) {
      console.error("[cms-members] Error cargando members:", err);
      if (window.Toast) window.Toast.error("Error al cargar datos: " + err.message);
      if (!append && refs.requestsList) {
        refs.requestsList.innerHTML =
          '<div class="empty-state danger">Error al cargar datos. Contáctate con soporte.</div>';
      }
      if (!append && window.Utils) window.Utils.setPageState(ui, {});
    } finally {
      state.isLoadingMore = false;
      if (!append && window.Utils) window.Utils.setPageState(ui, { loading: false });
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
        <div class="staff-row" role="listitem" data-instagram="${escapeHTML(igHandle)}" data-member-id="${m.id}" data-status="${status}" data-search="${escapeHTML(m._search || "")}" style="--stagger: ${index > 20 ? 0 : index}">
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
    window.Utils.setPageState(ui, { loading: true });

    try {
      const today = new Date();
      const currentDay = today.getDay(); // 0 is Sunday
      const startSunday = new Date(today);
      startSunday.setDate(today.getDate() - currentDay);

      const orConditions = [];
      const todayDay = today.getDate();
      const todayMonth = today.getMonth() + 1;
      
      const todayMatchStrings = [
         `${todayDay}/${todayMonth}/`,
         `${String(todayDay).padStart(2, "0")}/${todayMonth}/`,
         `${todayDay}/${String(todayMonth).padStart(2, "0")}/`,
         `${String(todayDay).padStart(2, "0")}/${String(todayMonth).padStart(2, "0")}/`
      ];

      for (let i = 0; i <= 7; i++) {
         const d = new Date(startSunday);
         d.setDate(startSunday.getDate() + i);
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
         .select("id, nombre, nacimiento, instagram, email, status")
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
          
          for (let i = 0; i <= 7; i++) {
              const testDate = new Date(startSunday);
              testDate.setDate(startSunday.getDate() + i);
              if (testDate.getDate() === d && (testDate.getMonth() + 1) === m) {
                  return i;
              }
          }
          return 99;
      }

      filteredData.sort((a, b) => getDaysSinceStart(a.nacimiento) - getDaysSinceStart(b.nacimiento));

      state.birthdayCount = countWeek;
      
      setText(refs.birthdayToday, countToday);
      setText(refs.countCumple, countWeek);
      updateStatusPill();

      window.Utils.setPageState(ui, {});

      if (filteredData.length === 0) {
        refs.birthdayList.innerHTML = `<div class="empty-state">
                  <p>No hay cumpleaños en la semana de domingo a domingo.</p>
              </div>`;
        return;
      }

      refs.birthdayList.innerHTML = filteredData
        .map((m) => renderBirthdayCard(m))
        .join("");

    } catch (err) {
      console.error("[cms-members] Error cargando cumpleaños:", err);
      if (window.Toast) window.Toast.error("Error cargando cumpleaños");
    } finally {
       window.Utils.setPageState(ui, { loading: false });
    }
  }

  function renderBirthdayCard(m) {
    const igHandle = (m.instagram || "").replace("@", "").trim();
    const igLink = igHandle
      ? `<a href="https://instagram.com/${encodeURIComponent(igHandle)}" target="_blank" class="accent">@${escapeHTML(igHandle)}</a>`
      : `<span class="faint">Sin IG</span>`;

    const tagHtml = m.isToday 
      ? `<span class="status-pill status-success" style="border: 1px solid var(--green-400); color: var(--green-400); font-weight: bold; padding: 4px 8px; font-size: 10px;">HOY</span>`
      : `<span class="status-pill status-neutral" style="border: 1px solid var(--neutral-600); color: var(--neutral-400); padding: 4px 8px; font-size: 10px;">${escapeHTML(m.nacimiento)}</span>`;

    return `
        <div class="staff-row" role="listitem" data-member-id="${m.id}" ${m.isToday ? 'style="border-left: 2px solid var(--green-400);"' : ''}>
            <div class="staff-info">
                <div class="row-flex gap-8 align-center">
                    <span class="staff-name" ${m.isToday ? 'style="color: var(--green-400);"' : ''}>${escapeHTML(m.nombre)}</span>
                    ${tagHtml}
                </div>
                
                <div class="row-flex gap-16 mt-4 text-sm">
                     <span>${igLink}</span>
                     <span class="muted">${escapeHTML(m.email || "")}</span>
                </div>
            </div>

            <div class="staff-actions">
                <button class="btn-primary btn-sm" data-action="greet" data-id="${m.id}" ${!m.isToday ? 'disabled title="Solo podés felicitar en el día"' : ''}>
                    🎁 FELICITAR
                </button>
            </div>
        </div>
        `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Acciones
  // ─────────────────────────────────────────────────────────────────────────
  async function processAction(action, memberId) {
    const member = state.members.find((m) => m.id === memberId);
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

        await loadMembers();
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
        await loadMembers();
        return;
      } catch (err) {
        console.error("Error al rechazar:", err);
        window.Toast.error("Error: " + err.message);
        return;
      }
    }
  }

  async function sendBirthdayGreeting(memberId) {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return;

    const confirmed = await window.Utils.confirmModal(`¿Enviar saludo de cumpleaños a ${member.nombre} (${member.email})?`);
    if (!confirmed) return;

    if (!window.APP_CONFIG?.EMAILJS?.TEMPLATE_CUMPLE) {
      window.Toast.error("Configuración de EmailJS faltante");
      return;
    }

    const params = {
      to_name: member.nombre,
      to_email: member.email,
      message: "¡Que tengas un excelente día!",
    };

    try {
      await emailjs.send(
        window.APP_CONFIG.EMAILJS.SERVICE_ID,
        window.APP_CONFIG.EMAILJS.TEMPLATE_CUMPLE,
        params,
      );

      window.Toast.success("¡Email enviado correctamente!");
    } catch (err) {
      console.error("Error enviando cumple:", err);
      window.Toast.error(
        "Error: " + (err.text || err.message || "Desconocido"),
      );
    }
  }

  function openBulkInstagrams() {
    const fromVal = parseInt(refs.instaFrom?.value || "0");
    const toVal = parseInt(refs.instaTo?.value || "0");

    if (!fromVal || !toVal || toVal < fromVal) {
      if (window.Toast) window.Toast.warning("Rango inválido");
      return;
    }

    const rows = refs.requestsList?.querySelectorAll(".staff-row:not(.hidden)") || [];
    const slice = Array.from(rows).slice(fromVal - 1, toVal);

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
  // 9. Vista Switching
  // ─────────────────────────────────────────────────────────────────────────
  function switchView(viewName) {
    state.currentView = viewName;

    refs.tabs.forEach((t) => {
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
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Event Listeners
  // ─────────────────────────────────────────────────────────────────────────

  // Tab switching
  refs.tabs.forEach((tab) => {
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

  // Intersection Observer for Lazy Loading
  if (refs.scrollSentinel && window.IntersectionObserver) {
    const observer = new IntersectionObserver((entries) => {
       if (entries[0].isIntersecting && state.hasMore && !state.isLoadingMore && state.currentView === "solicitudes") {
           loadMembers(state.currentPage + 1, true);
       }
    }, { rootMargin: "100px" });
    observer.observe(refs.scrollSentinel);
  }

  // Bulk Instagram
  refs.btnBulk?.addEventListener("click", openBulkInstagrams);

  // Delegated click handler for actions
  document.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const memberId = actionBtn.dataset.id;

    if (action === "greet") {
      sendBirthdayGreeting(memberId);
    } else {
      processAction(action, memberId);
    }
  });

  // EmailJS Init
  if (window.emailjs && window.APP_CONFIG?.EMAILJS) {
    try {
      emailjs.init(window.APP_CONFIG.EMAILJS.PUBLIC_KEY);
    } catch (e) {
      console.warn("EmailJS init error", e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Inicialización
  // ─────────────────────────────────────────────────────────────────────────
  await loadMembers();
})();
