function pressApp() {
  let textoArticulos = '';
  let textoFuentes = '';
  let textoConfig = '';
  let memoFiltro = { arts: null, q: null, src: null, prov: null, res: [] };
  let memoConteos = { arts: null, res: {} };
  let formateadorHora = null;
  let zonaFormateador = '';

  const LIMITE_SELECCION = 500;
  
  // ==============================================================================
  // CONFIGURACIÓN DE URL DEL BACKEND (DESACOPLADO)
  // Reemplazar esta constante con la URL real del backend en Neon/PaaS
  // ==============================================================================
  const BACKEND_URL = 'https://sintesis-backend-658k.onrender.com';

  function horaLocal(fecha, zona) {
    try {
      if (!formateadorHora || zonaFormateador !== zona) {
        formateadorHora = new Intl.DateTimeFormat('en-GB', {
          timeZone: zona, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        });
        zonaFormateador = zona;
      }
      const [h, m, s] = formateadorHora.format(fecha).split(':').map(Number);
      return { h, m, s };
    } catch (_) {
      return { h: fecha.getHours(), m: fecha.getMinutes(), s: fecha.getSeconds() };
    }
  }

  return {
    authHeader: null,
    activeView: 'feed',
    pendingTargetView: null,
    loginModalOpen: false,
    unsavedDialogOpen: false,
    pendingAdminView: null,
    pendingAdminLogout: false,
    settingsBaseline: null,
    adminUsernameInput: '',
    adminPasswordInput: '',

    allArticles: [],
    publicSources: [],
    allSources: [],
    allKeywords: [],
    selectedIds: [],
    articlePage: 1,
    articlesPerPage: 40,
    showSelectedDrawer: false,

    selectedSourceId: null,
    sourceSearch: '',
    searchQuery: '',
    provinceFilter: 'ALL',

    scraping: { running: false, done: 0, total: 0 },
    refreshing: false,
    exporting: false,
    creatingSource: false,
    importingSources: false,
    importLogs: [],
    importLogSearch: '',
    importLogPage: 0,
    importLogPageSize: 100,
    importLogTotal: 0,
    importLogRequest: 0,
    newSourceUrl: '',
    newSourceName: '',
    importStatusText: '',
    adminSourceFilter: '',
    adminSourceProvince: 'ALL',
    adminSourceStatusFilter: 'active',
    sourceRegionDialog: false,
    sourceRegionSource: null,
    sourceRegionValue: '',
    newKeyword: '',
    adminBackgroundText: '',

    interestProvinces: [],
    selectedInterestProvince: '',
    customInterestZone: '',
    systemStatus: {},

    publicConfig: {
      app_title: '',
      app_logo_url: '',
      app_primary_color: '',
      app_accent_color: '',
      app_background_color: '',
      timezone_name: '',
      window_cutoff_hour: null,
      regions: [],
      provinces_of_interest: [],
      has_active_keywords: false,
      timezones: [],
      window_label: '',
      ai_quota_exhausted_message: '',
      theme: {},
      theme_options: {},
      theme_defaults: {}
    },

    settingsForm: {
      ai_provider_name: '',
      ai_api_url: '',
      ai_api_protocol: 'openai_compatible',
      ai_api_key: '',
      key_badge: 'Sin clave',
      ai_model: '',
      ai_fallback_model: '',
      ai_max_output_parameter: 'max_completion_tokens',
      ai_temperature: 0.2,
      ai_max_words: 65,
      ai_request_interval_seconds: 8,
      ai_quota_exhausted_message: '',
      ai_system_prompt: '',
      default_system_prompt: '',
      app_title: '',
      app_logo_url: '',
      app_primary_color: '',
      app_accent_color: '',
      app_background_color: '',
      timezone_name: '',
      window_cutoff_hour: 6,
      export_document_title: '',
      include_empty_interest_sections: true,
      word_font_name: 'Arial',
      word_page_size: 'A4',
      word_orientation: 'portrait',
      word_font_size: 10.5,
      word_title_size: 14.0,
      word_line_spacing: 1.15,
      word_margin_top_cm: 1.8,
      word_margin_bottom_cm: 1.8,
      word_margin_left_cm: 1.9,
      word_margin_right_cm: 1.9,
      word_region_shading_hex: '#BFBFBF',
      word_justify_text: true,
    },

    toast: { visible: false, message: '', kind: 'success', timer: null },
    lastQueueSignature: '',
    queueInFlight: false,
    pollTick: 0,
    pollBusy: false,

    isDark: false,
    userModePref: null,
    themeDirty: false,
    savingTheme: false,
    themeForm: { mode: '', surface_color: '', dark_background_color: '', dark_surface_color: '', font: '', ui_scale: 100, radius: '' },

    help: { open: false, key: null },

    sourceNameDialog: false,
    sourceNameSource: null,
    sourceNameValue: '',
    savingSourceName: false,

    aiCatalog: [],
    aiProviderChoice: '',
    aiCustomUrl: '',
    aiDetect: { busy: false, ok: false, needsProvider: false, message: '', models: [] },
    aiTest: { busy: false, visible: false, ok: false, message: '', summary: '', article: null, detail: '' },

    async init() {
      window.addEventListener('beforeunload', event => {
        if (this.adminChanges.length) { event.preventDefault(); event.returnValue = ''; }
      });
      this.$watch('searchQuery', () => {
        this.articlePage = 1;
        this.requestSummariesForVisible(this.filteredArticles);
      });
      this.$watch('selectedSourceId', () => { this.articlePage = 1; });
      this.$watch('provinceFilter', () => { this.articlePage = 1; });
      this.$watch('importLogSearch', () => { this.importLogPage = 0; this.loadImportLogs(); });
      try { this.userModePref = localStorage.getItem('ui_mode_pref'); } catch (_) { this.userModePref = null; }
      window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => this.applyTheme());
      await this.loadArticles();
      this.startPolling();
    },

    showToast(message, kind = 'success', ms = 4500) {
      clearTimeout(this.toast.timer);
      this.toast.message = message;
      this.toast.kind = kind;
      this.toast.visible = true;
      this.toast.timer = setTimeout(() => { this.toast.visible = false; }, ms);
    },

    get appInitials() {
      const palabras = String(this.publicConfig.app_title || '').trim().split(/\s+/).filter(Boolean);
      if (!palabras.length) return '';
      return (palabras.length === 1 ? palabras[0].slice(0, 2) : palabras[0][0] + palabras[1][0]).toUpperCase();
    },

    get themeVars() {
      const t = this.publicConfig.theme || {};
      const vars = {};
      if (this.publicConfig.app_primary_color) vars['--app-primary'] = this.publicConfig.app_primary_color;
      if (this.publicConfig.app_accent_color) vars['--app-accent'] = this.publicConfig.app_accent_color;
      const fondo = this.isDark ? t.dark_background_color : this.publicConfig.app_background_color;
      if (fondo) vars['--app-bg'] = fondo;
      const superficie = this.isDark ? t.dark_surface_color : t.surface_color;
      if (superficie) vars['--app-surface'] = superficie;
      if (t.font_css) vars['--app-font'] = t.font_css;
      return vars;
    },

    mergePublicConfig(nueva) {
      const conservar = this.themeDirty ? {
        app_title: this.publicConfig.app_title,
        app_primary_color: this.publicConfig.app_primary_color,
        app_accent_color: this.publicConfig.app_accent_color,
        app_background_color: this.publicConfig.app_background_color,
        theme: this.publicConfig.theme
      } : {};
      this.publicConfig = { ...this.publicConfig, ...nueva, ...conservar };
      if (!this.themeDirty) this.syncThemeForm();
      this.applyTheme();
    },

    resolveDark() {
      const personal = this.userModePref === 'light' || this.userModePref === 'dark' ? this.userModePref : null;
      const modo = personal || this.publicConfig.theme?.mode || 'system';
      if (modo === 'dark') return true;
      if (modo === 'light') return false;
      return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
    },

    applyTheme() {
      const t = this.publicConfig.theme || {};
      this.isDark = this.resolveDark();
      const raiz = document.documentElement;
      raiz.classList.toggle('dark', this.isDark);
      raiz.dataset.radius = t.radius || 'normal';
      raiz.style.setProperty('--ui-scale', String((t.ui_scale || 100) / 100));
      if (t.font_href) {
        let enlace = document.getElementById('tema-fuente');
        if (!enlace) {
          enlace = document.createElement('link');
          enlace.id = 'tema-fuente';
          enlace.rel = 'stylesheet';
          document.head.appendChild(enlace);
        }
        if (enlace.getAttribute('href') !== t.font_href) enlace.setAttribute('href', t.font_href);
      }
      if (this.publicConfig.app_title) document.title = this.publicConfig.app_title;
    },

    toggleDarkMode() {
      this.userModePref = this.isDark ? 'light' : 'dark';
      try { localStorage.setItem('ui_mode_pref', this.userModePref); } catch (_) {}
      this.applyTheme();
    },

    syncThemeForm() {
      const t = this.publicConfig.theme || {};
      this.themeForm = {
        mode: t.mode ?? '',
        surface_color: t.surface_color ?? '',
        dark_background_color: t.dark_background_color ?? '',
        dark_surface_color: t.dark_surface_color ?? '',
        font: t.font ?? '',
        ui_scale: t.ui_scale ?? 100,
        radius: t.radius ?? ''
      };
    },

    previewTheme() {
      this.themeDirty = true;
      const fuente = (this.publicConfig.theme_options?.fonts || []).find(f => f.key === this.themeForm.font);
      this.publicConfig = {
        ...this.publicConfig,
        app_title: this.settingsForm.app_title,
        app_primary_color: this.settingsForm.app_primary_color,
        app_accent_color: this.settingsForm.app_accent_color,
        app_background_color: this.settingsForm.app_background_color,
        theme: {
          ...this.publicConfig.theme,
          ...this.themeForm,
          font_css: fuente ? fuente.css : this.publicConfig.theme?.font_css,
          font_href: fuente ? fuente.href : this.publicConfig.theme?.font_href
        }
      };
      this.applyTheme();
    },

    async discardThemePreview() {
      if (this.settingsBaseline) {
        for (const campo of ['app_title', 'app_primary_color', 'app_accent_color', 'app_background_color']) {
          this.settingsForm[campo] = this.settingsBaseline.settings[campo];
        }
        this.themeForm = { ...this.settingsBaseline.theme };
      }
      this.themeDirty = false;
      await this.loadArticles();
      this.showToast('Se descartó la vista previa.');
    },

    openHelp(key) { this.help = { open: true, key }; },
    closeHelp() { this.help = { open: false, key: null }; },
    get helpCurrent() { return this.helpTopics[this.help.key] || null; },

    helpTopics: {
      'admin-directory': { title: 'Directorio de medios', body: ['Control del estado operativo de cada diario.'] },
      'admin-ai': { title: 'Proveedor de Inteligencia Artificial', body: ['Motor de redacción automática de síntesis.'] },
      'admin-shift': { title: 'Horario del turno y zona horaria', body: ['Ventana operativa de 24 horas del sistema.'] },
      'admin-report': { title: 'Formato del documento Word', body: ['Ajustes de márgenes, tipografía e interlineado del documento Word.'] }
    },

    adminSnapshot() {
      const settings = { ...this.settingsForm };
      delete settings.key_badge;
      delete settings.default_system_prompt;
      return { settings, theme: { ...this.themeForm }, zones: [...this.interestProvinces] };
    },

    captureAdminBaseline(fields = null, includeTheme = true, includeZones = true) {
      const current = this.adminSnapshot();
      if (!this.settingsBaseline || fields === null) {
        this.settingsBaseline = current;
        return;
      }
      for (const field of fields) this.settingsBaseline.settings[field] = current.settings[field];
      if (includeTheme) this.settingsBaseline.theme = current.theme;
      if (includeZones) this.settingsBaseline.zones = current.zones;
    },

    get adminChanges() {
      if (!this.settingsBaseline) return [];
      const current = this.adminSnapshot();
      const labels = {
        ai_api_key: 'Clave de IA actualizada', ai_system_prompt: 'Prompt de síntesis',
        ai_provider_name: 'Proveedor de IA', ai_api_url: 'Endpoint de IA', ai_api_protocol: 'Protocolo de IA',
        ai_model: 'Modelo principal', ai_fallback_model: 'Modelo alternativo', ai_temperature: 'Temperatura',
        ai_max_words: 'Extensión de síntesis', ai_request_interval_seconds: 'Pausa entre solicitudes',
        timezone_name: 'Zona horaria', window_cutoff_hour: 'Horario del turno',
        app_title: 'Nombre de la aplicación', app_logo_url: 'Logo', app_primary_color: 'Color principal',
        app_accent_color: 'Color de acento', app_background_color: 'Color de fondo',
        export_document_title: 'Título del informe', include_empty_interest_sections: 'Secciones vacías',
        word_page_size: 'Papel del Word', word_orientation: 'Orientación del Word',
        word_font_name: 'Tipografía del Word', word_font_size: 'Tamaño del texto', word_title_size: 'Tamaño del título',
        word_line_spacing: 'Interlineado', word_margin_top_cm: 'Margen superior', word_margin_bottom_cm: 'Margen inferior',
        word_margin_left_cm: 'Margen izquierdo', word_margin_right_cm: 'Margen derecho',
        word_region_shading_hex: 'Color de zonas', word_justify_text: 'Alineación del texto'
      };
      const changes = Object.keys(current.settings).filter(key =>
        JSON.stringify(current.settings[key]) !== JSON.stringify(this.settingsBaseline.settings[key])
      ).map(key => labels[key] || 'Configuración');
      if (JSON.stringify(current.theme) !== JSON.stringify(this.settingsBaseline.theme)) changes.push('Tema visual');
      if (JSON.stringify(current.zones) !== JSON.stringify(this.settingsBaseline.zones)) changes.push('Zonas y orden del informe');
      return [...new Set(changes)];
    },

    get articleCountBySource() {
      const arts = this.allArticles;
      if (memoConteos.arts !== arts) {
        const mapa = {};
        for (const a of arts) {
          const id = Number(a.source?.id);
          mapa[id] = (mapa[id] || 0) + 1;
        }
        memoConteos = { arts, res: mapa };
      }
      return memoConteos.res;
    },

    get sourcesWithArticles() {
      return this.publicSources.filter(s => this.getSourceArticleCount(s.id) > 0);
    },

    get filteredPublicSources() {
      const q = this.sourceSearch.trim().toLowerCase();
      return this.sourcesWithArticles.filter(s => !q || `${s.name} ${s.province}`.toLowerCase().includes(q));
    },

    get availableProvinces() {
      return [...new Set(this.allArticles.map(a => a.source?.province).filter(Boolean))].sort();
    },

    get detectedKeywords() {
      return [...new Set(this.allArticles.flatMap(a => a.matched_keywords || []))].sort();
    },

    get filteredArticles() {
      const arts = this.allArticles;
      const q = this.searchQuery.trim().toLowerCase();
      const src = this.selectedSourceId;
      const prov = this.provinceFilter;
      if (memoFiltro.arts === arts && memoFiltro.q === q && memoFiltro.src === src && memoFiltro.prov === prov) {
        return memoFiltro.res;
      }
      const res = arts.filter(a =>
        (src === null || Number(a.source?.id) === src) &&
        (prov === 'ALL' || a.source?.province === prov) &&
        (!q || `${a.title} ${a.source?.name} ${a.source?.province} ${(a.matched_keywords || []).join(' ')}`.toLowerCase().includes(q))
      ).sort((a, b) => (Date.parse(this.fechaVisible(b) || '') || 0) - (Date.parse(this.fechaVisible(a) || '') || 0));
      memoFiltro = { arts, q, src, prov, res };
      return res;
    },

    get articlePageCount() {
      return Math.max(1, Math.ceil(this.filteredArticles.length / this.articlesPerPage));
    },

    get pageArticles() {
      const pagina = Math.min(this.articlePage, this.articlePageCount);
      const inicio = (pagina - 1) * this.articlesPerPage;
      return this.filteredArticles.slice(inicio, inicio + this.articlesPerPage);
    },

    get pendingAiCount() {
      return this.allArticles.filter(a => !a.no_keywords_mode && a.processing_status === 'PENDING' && a.summary_requested && !a.ai_quota_exhausted).length;
    },

    get statusSummary() {
      if (this.scraping.running) {
        return { title: 'Buscando noticias', sub: this.scraping.total ? `${this.scraping.done}/${this.scraping.total} medios` : 'Sincronizando...' };
      }
      if (this.publicConfig.has_active_keywords && this.pendingAiCount > 0) {
        return { title: 'Redactando IA', sub: `${this.pendingAiCount} pendientes` };
      }
      return { title: 'Todo al día', sub: 'Sincronizado' };
    },

    get adminAvailableProvinces() {
      return [...new Set(this.allSources.map(s => s.province).filter(Boolean))].sort();
    },

    get filteredAdminSources() {
      const q = this.adminSourceFilter.trim().toLowerCase();
      return this.allSources.filter(s =>
        (this.adminSourceStatusFilter === 'all' ||
          (this.adminSourceStatusFilter === 'active' ? Boolean(s.last_checked_at && !s.last_error) : Boolean(s.last_error || !s.last_checked_at))) &&
        (this.adminSourceProvince === 'ALL' || s.province === this.adminSourceProvince) &&
        (!q || `${s.name} ${s.base_url} ${s.province}`.toLowerCase().includes(q))
      );
    },

    get importLogPageCount() {
      return Math.max(1, Math.ceil(this.importLogTotal / this.importLogPageSize));
    },

    get availableInterestRegions() {
      const all = [...new Set([...(this.publicConfig.regions || []), ...this.interestProvinces])].sort();
      const seleccionadas = new Set(this.interestProvinces.map(region => this.normalizarNombreRegion(region)));
      return all.filter(region => !seleccionadas.has(this.normalizarNombreRegion(region)));
    },

    getSourceArticleCount(sourceId) {
      return this.articleCountBySource[Number(sourceId)] || 0;
    },

    tieneHoraReal(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return false;
      const l = horaLocal(d, this.publicConfig.timezone_name);
      return !(l.h === 0 && l.m === 0 && l.s === 0);
    },

    fechaVisible(a) {
      const pub = a.published_at;
      if (pub && this.tieneHoraReal(pub)) return pub;
      return a.date || pub || null;
    },

    canExport(art) {
      if (!art) return false;
      const regionesInteres = (this.publicConfig.provinces_of_interest || [])
        .map(region => this.normalizarNombreRegion(region));
      const provinciaArticulo = this.normalizarNombreRegion(art.source?.province);
      if (!regionesInteres.includes(provinciaArticulo)) return false;
      if (art.no_keywords_mode) return art.processing_status !== 'FAILED';
      return Boolean((art.summary || '').trim()) && art.processing_status === 'COMPLETED';
    },

    getExportBlockReason(art) {
      if (!art) return '';
      const regionesInteres = (this.publicConfig.provinces_of_interest || [])
        .map(region => this.normalizarNombreRegion(region));
      if (regionesInteres.length === 0) {
        return 'Primero agregá al menos una provincia en Administración → Zonas de interés.';
      }
      const provinciaArticulo = this.normalizarNombreRegion(art.source?.province);
      if (!regionesInteres.includes(provinciaArticulo)) {
        return `La región del diario («${art.source?.province || 'SIN CLASIFICAR'}») no está incluida en Zonas de interés.`;
      }
      if (!art.no_keywords_mode && (!Boolean((art.summary || '').trim()) || art.processing_status !== 'COMPLETED')) {
        return 'Todavía se está redactando la síntesis con IA para esta noticia.';
      }
      return 'No se pudo extraer texto de esta noticia.';
    },

    normalizarNombreRegion(region) {
      return String(region || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase('es-AR');
    },

    isSelected(id) {
      return this.selectedIds.includes(Number(id));
    },

    toggleArticleSelection(art) {
      if (!this.canExport(art)) {
        const motivo = this.getExportBlockReason(art);
        if (motivo) this.showToast(motivo, 'error', 3500);
        return;
      }
      const id = Number(art.id);
      if (this.isSelected(id)) {
        this.selectedIds = this.selectedIds.filter(x => x !== id);
      } else if (this.selectedIds.length >= LIMITE_SELECCION) {
        this.showToast(`Un informe admite hasta ${LIMITE_SELECCION} noticias.`, 'error', 3500);
      } else {
        this.selectedIds.push(id);
      }
    },

    removeSelected(id) {
      this.selectedIds = this.selectedIds.filter(x => x !== Number(id));
    },

    clearSelection() {
      this.selectedIds = [];
      this.showSelectedDrawer = false;
    },

    podarSeleccion() {
      if (!this.selectedIds.length) return;
      const vigentes = new Set(this.allArticles.map(a => Number(a.id)));
      const filtrados = this.selectedIds.filter(id => vigentes.has(id));
      if (filtrados.length !== this.selectedIds.length) this.selectedIds = filtrados;
    },

    getArticleTitle(id) {
      return this.allArticles.find(a => Number(a.id) === Number(id))?.title || '';
    },

    toggleSelectAllVisible() {
      const exportables = this.filteredArticles.filter(a => this.canExport(a)).map(a => Number(a.id));
      if (exportables.length === 0) {
        this.showToast('No hay noticias listas para exportar con los filtros actuales.', 'error');
        return;
      }
      const allSelected = exportables.every(id => this.selectedIds.includes(id));
      if (allSelected) {
        this.selectedIds = this.selectedIds.filter(id => !exportables.includes(id));
      } else {
        const unidas = [...new Set([...this.selectedIds, ...exportables])];
        this.selectedIds = unidas.slice(0, LIMITE_SELECCION);
        if (unidas.length > LIMITE_SELECCION) {
          this.showToast(`Se seleccionaron las primeras ${LIMITE_SELECCION} noticias (máximo por informe).`, 'error');
        }
      }
    },

    getSynthesisStyle(a) {
      if (a.no_keywords_mode) {
        const ext = (a.summary || '').trim();
        if (!ext && a.processing_status === 'FAILED') {
          return {
            label: 'No se pudo extraer el fragmento',
            badgeClass: 'text-rose-600',
            boxClass: 'bg-rose-50 border-rose-400 text-rose-800',
            text: a.last_error || 'El medio no permitió extraer texto. Abrí la nota original para leerla.'
          };
        }
        return {
          label: ext ? 'Fragmento listo para Word' : 'Extrayendo fragmento sin IA…',
          badgeClass: ext ? 'text-emerald-700' : 'text-slate-500',
          boxClass: 'bg-slate-50 border-slate-300 text-slate-600',
          text: ext || 'Se está leyendo el texto original para mostrar un fragmento.'
        };
      }
      if (a.processing_status === 'COMPLETED' && a.summary) {
        return {
          label: 'Síntesis IA lista para Word',
          badgeClass: 'text-emerald-700',
          boxClass: 'bg-indigo-50/40 border-indigo-500 text-slate-700',
          text: a.summary
        };
      }
      if (a.ai_quota_exhausted) {
        return {
          label: 'Cuota IA agotada',
          badgeClass: 'text-rose-600',
          boxClass: 'bg-rose-50 border-rose-500 text-rose-800',
          text: a.ai_quota_message || this.publicConfig.ai_quota_exhausted_message
        };
      }
      if (a.processing_status === 'FAILED') {
        return {
          label: 'Error de lectura',
          badgeClass: 'text-rose-600',
          boxClass: 'bg-rose-50 border-rose-400 text-rose-800',
          text: a.last_error || 'No se pudo procesar el artículo.'
        };
      }
      return {
        label: 'Redactando con IA...',
        badgeClass: 'text-amber-600',
        boxClass: 'bg-amber-50/50 border-amber-400 text-slate-500 italic',
        text: 'Generando síntesis periodística automática...'
      };
    },

    formatDateTime(iso) {
      if (!iso) return 'Sin hora';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'Sin hora';
      try {
        return new Intl.DateTimeFormat('es-AR', {
          timeZone: this.publicConfig.timezone_name,
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(d) + ' hs';
      } catch (_) {
        return d.toLocaleString('es-AR');
      }
    },

    // ==============================================================================
    // LLAMADAS API (Redirigidas al backend en Neon/PaaS)
    // ==============================================================================
    async apiFetch(url, opts = {}) {
      // Forzar la URL a apuntar al dominio del backend en vez de ser relativa al host actual
      const fullUrl = url.startsWith('/api/') ? `${BACKEND_URL}${url}` : url;
      
      const res = await fetch(fullUrl, { cache: 'no-store', ...opts });
      if (!res.ok) {
        let msg = res.statusText;
        try { const d = await res.json(); msg = d.detail || d.message || msg; } catch (_) {}
        throw new Error(msg);
      }
      return res;
    },

    async adminFetch(url, opts = {}) {
      if (!this.authHeader) throw new Error('Sesión administrativa requerida.');
      const res = await this.apiFetch(url, {
        ...opts,
        headers: { ...(opts.headers || {}), Authorization: this.authHeader }
      });
      return res.json();
    },

    async refreshData(completo = false) {
      this.pollTick += 1;
      const conFuentes = completo || this.scraping.running || this.pollTick % 4 === 0;
      const conConfig = completo || this.pollTick % 10 === 0;
      const [artRes, stRes, srcRes, cfgRes] = await Promise.all([
        this.apiFetch('/api/articles'),
        this.apiFetch('/api/refresh/status'),
        conFuentes ? this.apiFetch('/api/sources') : null,
        conConfig ? this.apiFetch('/api/config/public') : null
      ]);

      if (cfgRes) {
        const txt = await cfgRes.text();
        if (completo || txt !== textoConfig) {
          textoConfig = txt;
          this.mergePublicConfig(JSON.parse(txt));
        }
      }
      const st = await stRes.json();
      this.scraping = { running: Boolean(st.running), done: Number(st.sources || 0), total: Number(st.sources_total || 0) };

      const txtArt = await artRes.text();
      if (txtArt !== textoArticulos) {
        textoArticulos = txtArt;
        this.allArticles = JSON.parse(txtArt);
        this.podarSeleccion();
      }
      if (srcRes) {
        const txt = await srcRes.text();
        if (txt !== textoFuentes) {
          textoFuentes = txt;
          this.publicSources = JSON.parse(txt);
        }
      }
      if (this.selectedSourceId !== null && this.getSourceArticleCount(this.selectedSourceId) === 0) {
        this.selectedSourceId = null;
      }
      this.requestSummariesForVisible(this.filteredArticles);
      return st;
    },

    async loadArticles() {
      try {
        await this.refreshData(true);
      } catch (e) {
        this.showToast(e.message, 'error');
      }
    },

    async sondear() {
      const st = await this.refreshData(false);
      if (st.work) {
        this.adminBackgroundText = `${st.work.name || 'Procesando'}${st.work.total ? `: ${st.work.current}/${st.work.total}` : ''}${st.work.detail ? ` · ${st.work.detail}` : ''}`;
      } else {
        this.adminBackgroundText = '';
      }
      if (this.authHeader && this.activeView === 'system') {
        this.systemStatus = await this.adminFetch('/api/admin/status');
      }
    },

    startPolling() {
      const ciclo = async () => {
        if (!document.hidden && !this.pollBusy) {
          this.pollBusy = true;
          try { await this.sondear(); } catch (_) {} finally { this.pollBusy = false; }
        }
        setTimeout(ciclo, 4500);
      };
      setTimeout(ciclo, 4500);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !this.pollBusy) this.sondear().catch(() => {});
      });
    },

    async requestSummariesForVisible(arts) {
      const ids = arts.filter(a => {
        if (a.processing_status === 'FAILED') return false;
        if (a.no_keywords_mode) {
          return !Boolean((a.summary || '').trim()) && !a.summary_requested;
        }
        return Boolean(a.matched_keywords?.length) && a.processing_status === 'PENDING' && !a.summary_requested;
      }).map(a => a.id);

      if (!ids.length || this.queueInFlight || ids.join(',') === this.lastQueueSignature) return;
      this.queueInFlight = true;
      try {
        for (let i = 0; i < ids.length; i += 500) {
          await this.apiFetch('/api/articles/request-summaries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_ids: ids.slice(i, i + 500) })
          });
        }
        this.lastQueueSignature = ids.join(',');
      } catch (_) {} finally {
        this.queueInFlight = false;
      }
    },

    async triggerManualRefresh() {
      this.refreshing = true;
      try {
        const res = await this.apiFetch('/api/refresh', { method: 'POST' });
        const d = await res.json();
        this.showToast(d.message || 'Actualizando noticias...');
        await this.loadArticles();
      } catch (e) {
        this.showToast(e.message, 'error');
      } finally {
        this.refreshing = false;
      }
    },

    async exportSelectedArticles() {
      if (!this.selectedIds.length) {
        this.showToast('Seleccioná al menos una noticia para exportar a Word.', 'error');
        return;
      }
      if (this.selectedIds.length > LIMITE_SELECCION) {
        this.showToast(`Un informe admite hasta ${LIMITE_SELECCION} noticias. Quitá algunas de la selección.`, 'error');
        return;
      }
      this.exporting = true;
      try {
        const res = await this.apiFetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_ids: this.selectedIds })
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const base = String(this.publicConfig.app_title || 'informe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'informe';
        a.download = `${base}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.showToast('Informe Word descargado con éxito.');
      } catch (e) {
        this.showToast(e.message, 'error');
      } finally {
        this.exporting = false;
      }
    },

    openAdmin(target = 'sources') {
      if (this.authHeader) {
        this.navigateToView(target);
      } else {
        this.pendingTargetView = target;
        this.adminPasswordInput = '';
        this.loginModalOpen = true;
        setTimeout(() => this.$refs.passInput?.focus(), 50);
      }
    },

    async submitLogin() {
      const candidate = `Basic ${btoa(unescape(encodeURIComponent(`${this.adminUsernameInput}:${this.adminPasswordInput}`)))}`;
      try {
        await this.apiFetch('/api/admin/status', { headers: { Authorization: candidate } });
        this.authHeader = candidate;
        this.loginModalOpen = false;
        await Promise.all([this.loadAdminData(), this.loadSystemSettings()]);
        this.navigateToView(this.pendingTargetView || 'sources');
        this.showToast('Sesión iniciada.');
      } catch (e) {
        this.showToast(e.message || 'No se pudo iniciar sesión.', 'error');
      }
    },

    logoutAdmin() {
      if (this.adminChanges.length) {
        this.pendingAdminView = 'feed';
        this.pendingAdminLogout = true;
        this.unsavedDialogOpen = true;
        return;
      }
      this.authHeader = null;
      this.activeView = 'feed';
      this.showToast('Sesión cerrada.');
    },

    navigateToView(v) {
      if (v === 'feed' && this.activeView !== 'feed' && this.adminChanges.length) {
        this.pendingAdminView = v;
        this.pendingAdminLogout = false;
        this.unsavedDialogOpen = true;
        return false;
      }
      this.activeView = v;
      if (v === 'feed') {
        this.loadArticles();
      } else if (this.authHeader) {
        this.loadAdminData();
      }
      return true;
    },

    async saveAllAdminSettings() {
      try {
        const f = this.settingsForm;
        await this.adminFetch('/api/admin/settings', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_title: f.app_title, app_logo_url: f.app_logo_url, app_primary_color: f.app_primary_color,
            app_accent_color: f.app_accent_color, app_background_color: f.app_background_color,
            export_document_title: f.export_document_title, timezone_name: f.timezone_name,
            window_cutoff_hour: Number(f.window_cutoff_hour), provinces_of_interest: this.interestProvinces,
            include_empty_interest_sections: Boolean(f.include_empty_interest_sections),
            word_page_size: f.word_page_size, word_orientation: f.word_orientation,
            word_font_name: f.word_font_name, word_font_size: Number(f.word_font_size),
            word_title_size: Number(f.word_title_size), word_line_spacing: Number(f.word_line_spacing),
            word_margin_top_cm: Number(f.word_margin_top_cm), word_margin_bottom_cm: Number(f.word_margin_bottom_cm),
            word_margin_left_cm: Number(f.word_margin_left_cm), word_margin_right_cm: Number(f.word_margin_right_cm),
            word_region_shading_hex: f.word_region_shading_hex, word_justify_text: Boolean(f.word_justify_text),
            ai_provider_name: f.ai_provider_name, ai_api_url: f.ai_api_url, ai_api_protocol: f.ai_api_protocol,
            ai_api_key: f.ai_api_key || null, ai_model: f.ai_model, ai_fallback_model: f.ai_fallback_model,
            ai_max_output_parameter: f.ai_max_output_parameter, ai_system_prompt: f.ai_system_prompt,
            ai_temperature: Number(f.ai_temperature), ai_max_words: Number(f.ai_max_words),
            ai_request_interval_seconds: Number(f.ai_request_interval_seconds),
            ai_quota_exhausted_message: f.ai_quota_exhausted_message
          })
        });
        await this.adminFetch('/api/admin/theme', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.themeForm)
        });
        this.themeDirty = false;
        await this.loadSystemSettings();
        await this.refreshData(true);
        this.captureAdminBaseline();
        this.showToast('Cambios guardados.');
        this.unsavedDialogOpen = false;
        this.continueAfterAdminPrompt();
      } catch (e) { this.showToast(`No se pudieron guardar todos los cambios: ${e.message}`, 'error', 7000); }
    },

    async discardAllAdminSettings() {
      this.unsavedDialogOpen = false;
      this.settingsForm = { ...this.settingsBaseline.settings };
      this.themeForm = { ...this.settingsBaseline.theme };
      this.interestProvinces = [...this.settingsBaseline.zones];
      this.themeDirty = false;
      await this.refreshData(true);
      this.continueAfterAdminPrompt();
    },

    continueAfterAdminPrompt() {
      const destino = this.pendingAdminView || 'feed';
      const cerrarSesion = this.pendingAdminLogout;
      this.pendingAdminView = null;
      this.pendingAdminLogout = false;
      if (cerrarSesion) {
        this.authHeader = null;
        this.activeView = 'feed';
        this.showToast('Sesión cerrada.');
      } else {
        this.navigateToView(destino);
      }
    },

    cancelAdminPrompt() {
      this.unsavedDialogOpen = false;
      this.pendingAdminView = null;
      this.pendingAdminLogout = false;
    },

    async loadImportLogs() {
      if (!this.authHeader) return;
      const request = ++this.importLogRequest;
      const params = new URLSearchParams({
        q: this.importLogSearch.trim(), limit: this.importLogPageSize,
        offset: this.importLogPage * this.importLogPageSize
      });
      try {
        const result = await this.adminFetch(`/api/admin/sources/import-log?${params}`);
        if (request !== this.importLogRequest) return;
        this.importLogs = result.items || [];
        this.importLogTotal = Number(result.total || 0);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async moveImportLogPage(delta) {
      this.importLogPage = Math.max(0, Math.min(this.importLogPageCount - 1, this.importLogPage + delta));
      await this.loadImportLogs();
    },

    async loadAdminData() {
      try {
        const [status, sources, keywords] = await Promise.all([
          this.adminFetch('/api/admin/status'),
          this.adminFetch('/api/admin/sources'),
          this.adminFetch('/api/admin/keywords')
        ]);
        this.systemStatus = status;
        this.allSources = sources;
        this.allKeywords = keywords;
        await this.loadImportLogs();
      } catch (e) {
        this.showToast(e.message, 'error');
      }
    },

    async loadSystemSettings() {
      try {
        const c = await this.adminFetch('/api/admin/settings');
        this.settingsForm = {
          ai_provider_name: c.ai_provider_name || '',
          ai_api_url: c.ai_api_url || '',
          ai_api_protocol: c.ai_api_protocol || 'openai_compatible',
          ai_api_key: '',
          key_badge: c.has_api_key ? `Activa (${c.ai_api_key_masked})` : 'Sin clave',
          ai_model: c.ai_model || '',
          ai_fallback_model: c.ai_fallback_model || '',
          ai_max_output_parameter: c.ai_max_output_parameter || 'max_completion_tokens',
          ai_temperature: c.ai_temperature ?? 0.2,
          ai_max_words: c.ai_max_words ?? 65,
          ai_request_interval_seconds: c.ai_request_interval_seconds ?? 8,
          ai_quota_exhausted_message: c.ai_quota_exhausted_message || '',
          ai_system_prompt: c.ai_system_prompt || '',
          default_system_prompt: c.default_system_prompt || '',
          app_title: c.app_title || '',
          app_logo_url: c.app_logo_url || '',
          app_primary_color: c.app_primary_color || '',
          app_accent_color: c.app_accent_color || '',
          app_background_color: c.app_background_color || '',
          timezone_name: c.timezone_name || '',
          window_cutoff_hour: c.window_cutoff_hour ?? 6,
          export_document_title: c.export_document_title || '',
          include_empty_interest_sections: c.include_empty_interest_sections !== false,
          word_font_name: c.word_font_name || 'Arial',
          word_page_size: c.word_page_size || 'A4',
          word_orientation: c.word_orientation || 'portrait',
          word_font_size: c.word_font_size ?? 10.5,
          word_title_size: c.word_title_size ?? 14.0,
          word_line_spacing: c.word_line_spacing ?? 1.15,
          word_margin_top_cm: c.word_margin_top_cm ?? 1.8,
          word_margin_bottom_cm: c.word_margin_bottom_cm ?? 1.8,
          word_margin_left_cm: c.word_margin_left_cm ?? 1.9,
          word_margin_right_cm: c.word_margin_right_cm ?? 1.9,
          word_region_shading_hex: c.word_region_shading_hex || '#BFBFBF',
          word_justify_text: c.word_justify_text !== false,
        };
        this.interestProvinces = [...(c.provinces_of_interest || [])];
        this.captureAdminBaseline();
        if (!this.aiCatalog.length) this.loadAiCatalog();
      } catch (_) {}
    },

    restaurarPromptBase() {
      if (this.settingsForm.default_system_prompt) {
        this.settingsForm.ai_system_prompt = this.settingsForm.default_system_prompt;
        this.showToast('Prompt restaurado al original de fábrica.');
      } else {
        this.showToast('No se encontró el prompt base.', 'error');
      }
    },

    async createSource() {
      this.creatingSource = true;
      try {
        const r = await this.adminFetch('/api/admin/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.newSourceName.trim(), base_url: this.newSourceUrl.trim() })
        });
        this.newSourceUrl = '';
        this.newSourceName = '';
        await Promise.all([this.loadAdminData(), this.loadArticles()]);
        this.showToast(r.message);
      } catch (e) {
        this.showToast(e.message, 'error');
      } finally {
        this.creatingSource = false;
      }
    },

    async handleTxtImport(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      this.importStatusText = `Importando ${file.name}...`;
      this.importingSources = true;
      try {
        const content = await file.text();
        const r = await this.adminFetch('/api/admin/sources/import-txt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        this.importStatusText = `Listo: ${r.added} agregados, ${r.skipped_duplicates} duplicados, ${r.invalid_lines} inválidos.`;
        await Promise.all([this.loadAdminData(), this.loadArticles()]);
        this.showToast(r.message);
      } catch (err) {
        this.importStatusText = 'Error en la importación';
        this.showToast(err.message, 'error');
      } finally {
        this.importingSources = false;
        e.target.value = '';
      }
    },

    async testSource(id) {
      try {
        const r = await this.adminFetch(`/api/admin/sources/${id}/test`, { method: 'POST' });
        await this.loadAdminData();
        this.showToast(r.message);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async deleteSource(id) {
      try {
        const r = await this.adminFetch(`/api/admin/sources/${id}`, { method: 'DELETE' });
        await Promise.all([this.loadAdminData(), this.loadArticles()]);
        this.showToast(r.message || 'Medio eliminado.');
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    editSourceRegion(source) {
      this.sourceRegionSource = source;
      this.sourceRegionValue = source.province === 'SIN CLASIFICAR' ? '' : source.province;
      this.sourceRegionDialog = true;
    },

    async saveSourceRegion(automatic = false) {
      if (!this.sourceRegionSource) return;
      try {
        const result = await this.adminFetch(`/api/admin/sources/${this.sourceRegionSource.id}/province`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ province: automatic ? null : this.sourceRegionValue, automatic })
        });
        this.sourceRegionDialog = false;
        await Promise.all([this.loadAdminData(), this.loadArticles()]);
        this.showToast(automatic ? 'Clasificación automática reactivada.' : `Provincia fijada: ${result.province}.`);
      } catch (error) {
        this.showToast(error.message, 'error');
      }
    },

    countKeywordMatches(word) {
      return this.allArticles.filter(a => (a.matched_keywords || []).some(m => m.toLowerCase() === word.toLowerCase())).length;
    },

    async createKeyword() {
      if (!this.newKeyword.trim()) return;
      try {
        const r = await this.adminFetch('/api/admin/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: this.newKeyword.trim() })
        });
        this.newKeyword = '';
        this.lastQueueSignature = '';
        await Promise.all([this.loadArticles(), this.loadAdminData()]);
        this.showToast(r.message);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async deleteKeyword(id) {
      try {
        const r = await this.adminFetch(`/api/admin/keywords/${id}`, { method: 'DELETE' });
        this.lastQueueSignature = '';
        await Promise.all([this.loadArticles(), this.loadAdminData()]);
        this.showToast(r.message || 'Tema eliminado.');
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async saveAiSettings() {
      try {
        const r = await this.adminFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ai_provider_name: this.settingsForm.ai_provider_name,
            ai_api_url: this.settingsForm.ai_api_url,
            ai_api_protocol: this.settingsForm.ai_api_protocol,
            ai_api_key: this.settingsForm.ai_api_key || null,
            ai_model: this.settingsForm.ai_model,
            ai_fallback_model: this.settingsForm.ai_fallback_model,
            ai_max_output_parameter: this.settingsForm.ai_max_output_parameter,
            ai_temperature: Number(this.settingsForm.ai_temperature),
            ai_max_words: Number(this.settingsForm.ai_max_words),
            ai_request_interval_seconds: Number(this.settingsForm.ai_request_interval_seconds),
            ai_quota_exhausted_message: this.settingsForm.ai_quota_exhausted_message,
            ai_system_prompt: this.settingsForm.ai_system_prompt
          })
        });
        const claveConfigurada = Boolean(this.settingsForm.ai_api_key.trim());
        const camposAi = Object.keys(this.settingsForm).filter(campo => campo.startsWith('ai_'));
        this.settingsForm.ai_api_key = '';
        if (claveConfigurada) this.settingsForm.key_badge = 'Clave actualizada';
        this.captureAdminBaseline(camposAi, false, false);
        this.showToast(r.message);
        return true;
      } catch (e) { this.showToast(e.message, 'error'); return false; }
    },

    async saveIdentitySettings() {
      try {
        const r = await this.adminFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timezone_name: this.settingsForm.timezone_name,
            window_cutoff_hour: Number(this.settingsForm.window_cutoff_hour)
          })
        });
        await this.loadArticles();
        this.captureAdminBaseline(['timezone_name', 'window_cutoff_hour'], false, false);
        this.showToast(r.message);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async saveThemeSettings() {
      this.savingTheme = true;
      try {
        await this.adminFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_title: this.settingsForm.app_title,
            app_primary_color: this.settingsForm.app_primary_color,
            app_accent_color: this.settingsForm.app_accent_color,
            app_background_color: this.settingsForm.app_background_color
          })
        });
        const r = await this.adminFetch('/api/admin/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.themeForm)
        });
        this.themeDirty = false;
        await this.loadArticles();
        this.captureAdminBaseline(['app_title', 'app_primary_color', 'app_accent_color', 'app_background_color'], true, false);
        this.showToast(r.message);
      } catch (e) {
        this.showToast(e.message, 'error');
      } finally {
        this.savingTheme = false;
      }
    },

    resetDefaultColors() {
      const d = this.publicConfig.theme_defaults || {};
      if (!Object.keys(d).length) {
        this.showToast('No se pudieron obtener los valores originales del servidor.', 'error');
        return;
      }
      this.settingsForm.app_primary_color = d.app_primary_color;
      this.settingsForm.app_accent_color = d.app_accent_color;
      this.settingsForm.app_background_color = d.app_background_color;
      this.themeForm = {
        mode: d.mode,
        surface_color: d.surface_color,
        dark_background_color: d.dark_background_color,
        dark_surface_color: d.dark_surface_color,
        font: d.font,
        ui_scale: d.ui_scale,
        radius: d.radius
      };
      this.previewTheme();
    },

    async uploadAppLogo(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const response = await this.apiFetch('/api/admin/branding/logo', {
          method: 'PUT',
          headers: { Authorization: this.authHeader, 'Content-Type': file.type },
          body: file
        });
        const result = await response.json();
        this.settingsForm.app_logo_url = result.app_logo_url;
        this.captureAdminBaseline(['app_logo_url'], false, false);
        await this.loadArticles();
        this.showToast(result.message);
      } catch (error) {
        this.showToast(error.message, 'error');
      } finally {
        event.target.value = '';
      }
    },

    async saveReportSettings() {
      try {
        const r = await this.adminFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            export_document_title: this.settingsForm.export_document_title,
            include_empty_interest_sections: this.settingsForm.include_empty_interest_sections,
            provinces_of_interest: this.interestProvinces,
            word_page_size: this.settingsForm.word_page_size,
            word_orientation: this.settingsForm.word_orientation,
            word_font_name: this.settingsForm.word_font_name,
            word_font_size: Number(this.settingsForm.word_font_size),
            word_title_size: Number(this.settingsForm.word_title_size),
            word_line_spacing: Number(this.settingsForm.word_line_spacing),
            word_margin_top_cm: Number(this.settingsForm.word_margin_top_cm),
            word_margin_bottom_cm: Number(this.settingsForm.word_margin_bottom_cm),
            word_margin_left_cm: Number(this.settingsForm.word_margin_left_cm),
            word_margin_right_cm: Number(this.settingsForm.word_margin_right_cm),
            word_region_shading_hex: this.settingsForm.word_region_shading_hex,
            word_justify_text: Boolean(this.settingsForm.word_justify_text)
          })
        });
        await this.loadArticles();
        this.captureAdminBaseline([
          'export_document_title', 'include_empty_interest_sections', 'word_page_size', 'word_orientation',
          'word_font_name', 'word_font_size', 'word_title_size', 'word_line_spacing', 'word_margin_top_cm',
          'word_margin_bottom_cm', 'word_margin_left_cm', 'word_margin_right_cm', 'word_region_shading_hex', 'word_justify_text'
        ], false, true);
        this.showToast(r.message);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async saveInterestZones() {
      try {
        const r = await this.adminFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provinces_of_interest: this.interestProvinces })
        });
        await this.loadArticles();
        this.captureAdminBaseline([], false, true);
        this.showToast(r.message);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    addInterestZone(z) {
      const clean = String(z || '').trim().replace(/\s+/g, ' ');
      if (!clean) {
        this.showToast('Elegí una provincia o escribí el nombre de una zona.', 'error');
        return false;
      }
      const duplicada = this.interestProvinces.some(
        region => this.normalizarNombreRegion(region) === this.normalizarNombreRegion(clean)
      );
      if (duplicada) {
        this.showToast(`La zona «${clean}» ya está en la lista.`, 'error');
        return false;
      }
      this.interestProvinces.push(clean);
      this.showToast(`Zona «${clean}» agregada. Guardá los cambios para aplicarla.`, 'success');
      return true;
    },

    addSelectedInterestProvince() {
      if (this.addInterestZone(this.selectedInterestProvince)) this.selectedInterestProvince = '';
    },

    addCustomInterestZone() {
      if (this.addInterestZone(this.customInterestZone)) this.customInterestZone = '';
    },

    removeInterestZone(indice) {
      this.interestProvinces.splice(indice, 1);
    },

    moveZone(idx, dir) {
      const target = idx + dir;
      if (target < 0 || target >= this.interestProvinces.length) return;
      const temp = this.interestProvinces[idx];
      this.interestProvinces[idx] = this.interestProvinces[target];
      this.interestProvinces[target] = temp;
    },

    async loadAiCatalog() {
      try { this.aiCatalog = await this.adminFetch('/api/admin/settings/ai-providers'); } catch (_) {}
    },

    async detectAiProvider() {
      this.aiDetect = { ...this.aiDetect, busy: true, ok: false, needsProvider: false, message: '' };
      try {
        const r = await this.adminFetch('/api/admin/settings/detect-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: this.settingsForm.ai_api_key || null,
            api_url: this.aiCustomUrl || null,
            provider: this.aiProviderChoice || null
          })
        });
        const modelos = r.models || [];
        this.aiDetect = { busy: false, ok: Boolean(r.detected), needsProvider: Boolean(r.needs_provider), message: r.message || '', models: modelos };
        if (!r.detected) return;

        const cambioProveedor = this.settingsForm.ai_provider_name !== r.provider_name;
        this.settingsForm.ai_provider_name = r.provider_name;
        this.settingsForm.ai_api_url = r.api_url;
        this.settingsForm.ai_api_protocol = r.api_protocol;
        this.settingsForm.ai_max_output_parameter = r.max_output_parameter;
        const invalido = (m) => !m || (modelos.length > 0 && !modelos.includes(m));
        if (cambioProveedor || invalido(this.settingsForm.ai_model)) this.settingsForm.ai_model = r.suggested_model || '';
        if (cambioProveedor || invalido(this.settingsForm.ai_fallback_model)) this.settingsForm.ai_fallback_model = r.suggested_fallback_model || '';

        if (!this.settingsForm.ai_model) {
          this.aiDetect.ok = false;
          this.aiDetect.message = `${r.message} Escribí el nombre del modelo y guardá.`;
          return;
        }
        if (await this.saveAiSettings()) this.aiDetect.message = `${r.message} Configuración guardada.`;
      } catch (e) {
        this.aiDetect = { busy: false, ok: false, needsProvider: false, message: e.message, models: this.aiDetect.models };
      }
    },

    async testAiConnection() {
      this.aiTest = { busy: true, visible: false, ok: false, message: '', summary: '', article: null, detail: '' };
      try {
        const r = await this.adminFetch('/api/admin/settings/test-ai', { method: 'POST' });
        const detalle = [
          r.provider && `Proveedor: ${r.provider}`,
          r.model && `Modelo: ${r.model}`,
          r.models_available ? `${r.models_available} modelos disponibles en la cuenta` : '',
          r.latency_ms ? `Respuesta en ${(r.latency_ms / 1000).toFixed(1)} s` : ''
        ].filter(Boolean).join(' · ');
        this.aiTest = { busy: false, visible: true, ok: true, message: r.message, summary: r.sample_summary || '', article: r.article || null, detail: detalle };
      } catch (e) {
        this.aiTest = { busy: false, visible: true, ok: false, message: e.message, summary: '', article: null, detail: '' };
      }
    },

    editSourceName(source) {
      this.sourceNameSource = source;
      this.sourceNameValue = source.name || '';
      this.sourceNameDialog = true;
      setTimeout(() => this.$refs.sourceNameInput?.focus(), 50);
    },

    async saveSourceName() {
      if (!this.sourceNameSource) return;
      this.savingSourceName = true;
      try {
        const r = await this.adminFetch(`/api/admin/sources/${this.sourceNameSource.id}/name`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.sourceNameValue })
        });
        this.sourceNameDialog = false;
        await Promise.all([this.loadAdminData(), this.loadArticles()]);
        this.showToast(`Nombre actualizado: ${r.name}.`);
      } catch (e) {
        this.showToast(e.message, 'error');
      } finally {
        this.savingSourceName = false;
      }
    },

    async runAdminScrapeNow() {
      try {
        const r = await this.adminFetch('/api/admin/scrape', { method: 'POST' });
        await this.loadArticles();
        this.showToast(r.message);
      } catch (e) { this.showToast(e.message, 'error'); }
    },

    async retryFailedArticles() {
      try {
        const r = await this.adminFetch('/api/admin/articles/retry-failed', { method: 'POST' });
        await this.loadAdminData();
        this.showToast(`${r.count} noticia(s) reabiertas.`);
      } catch (e) { this.showToast(e.message, 'error'); }
    }
  };
}
