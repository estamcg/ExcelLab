// pages/index.tsx
import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";

// ── Types ──────────────────────────────────────────────────────
type Doc = {
  id: string; title: string; description: string;
  type: string; level: string; icon: string;
  fileName: string; fileUrl: string; fileSize: string;
  createdAt: string; _count?: { downloads: number };
};
type Student = {
  id: string; name: string; email: string; image?: string;
  lastLogin?: string; createdAt: string; _count?: { downloads: number };
};
type Stats = {
  totalDocs: number; totalStudents: number; totalDownloads: number;
  docsByType: { type: string; _count: { id: number } }[];
  recentDownloads: { user: { name: string; email: string }; document: { title: string; icon: string }; createdAt: string }[];
};

// ── Helpers ────────────────────────────────────────────────────
const LEVEL_LABEL: Record<string, string> = {
  DEBUTANT: "Débutant", INTERMEDIAIRE: "Intermédiaire",
  AVANCE: "Avancé", TOUS: "Tous niveaux",
};
const TYPE_LABEL: Record<string, string> = {
  COURS: "Cours", LIVRE: "Livre", EXERCICE: "Exercice",
  FICHE: "Fiche", AUTRE: "Autre",
};
const levelClass = (l: string) =>
  l === "DEBUTANT" ? s.levelA : l === "INTERMEDIAIRE" ? s.levelB : l === "AVANCE" ? s.levelC : s.levelD;
const typeBadge = (t: string) =>
  t === "COURS" ? s.badgeGreen : t === "LIVRE" ? s.badgeBlue : t === "EXERCICE" ? s.badgeGold : s.badgeRed;

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Toast ──────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState({ msg: "", type: "", show: false });
  const show = (msg: string, type = "success") => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  };
  return { toast, show };
}

// ══════════════════════════════════════════════════════════════
export default function Home() {
  const { data: session, status } = useSession();
  const { toast, show: showToast } = useToast();
  const role = (session?.user as any)?.role;

  const [view, setView] = useState<"home" | "student" | "admin">("home");
  const [adminModal, setAdminModal] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Données
  const [docs, setDocs] = useState<Doc[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  // Filtres étudiant
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterType, setFilterType] = useState("");

  // Admin tabs
  const [adminTab, setAdminTab] = useState<"documents" | "upload" | "students">("documents");

  // Upload form
  const [form, setForm] = useState({ title: "", description: "", type: "COURS", level: "DEBUTANT", icon: "📊" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit modal
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", type: "", level: "", icon: "" });

  // Auto-redirect après login
  useEffect(() => {
    if (status === "authenticated") {
      if (role === "ADMIN") { setView("admin"); loadAdminData(); }
      else if (role === "STUDENT") { setView("student"); loadDocs(); }
    }
    if (status === "unauthenticated") setView("home");
  }, [status, role]);

  // Fermer menu user au clic extérieur
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Chargement données ──
  async function loadDocs() {
    setLoading(true);
    const r = await fetch("/api/documents");
    if (r.ok) setDocs(await r.json());
    setLoading(false);
  }

  async function loadAdminData() {
    setLoading(true);
    const [docsR, studentsR, statsR] = await Promise.all([
      fetch("/api/documents"),
      fetch("/api/students"),
      fetch("/api/admin/stats"),
    ]);
    if (docsR.ok) setDocs(await docsR.json());
    if (studentsR.ok) setStudents(await studentsR.json());
    if (statsR.ok) setStats(await statsR.json());
    setLoading(false);
  }

  // ── Auth ──
  async function handleAdminLogin() {
    setAdminErr("");
    const r = await signIn("admin-credentials", { adminId, password: adminPw, redirect: false });
    if (r?.ok) { setAdminModal(false); setAdminId(""); setAdminPw(""); showToast("Bienvenue, Prof. Hermellon 👩‍🏫"); }
    else setAdminErr("Identifiant ou mot de passe incorrect.");
  }

  async function handleLogout() {
    await signOut({ redirect: false });
    setView("home"); setDocs([]); setStudents([]); setStats(null);
    showToast("Déconnexion réussie");
  }

  // ── Download ──
  async function handleDownload(doc: Doc) {
    const r = await fetch(`/api/documents/${doc.id}/download`);
    if (!r.ok) { showToast("Erreur lors du téléchargement", "error"); return; }
    const { url, fileName } = await r.json();
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast(`⬇ Téléchargement de « ${doc.title} » lancé`);
  }

  // ── Upload ──
  async function handleUpload() {
    if (!form.title.trim()) { showToast("Veuillez entrer un titre", "error"); return; }
    if (!file) { showToast("Veuillez sélectionner un fichier", "error"); return; }
    setUploading(true);
    try {
      // 1. Upload fichier
      const fd = new FormData(); fd.append("file", file);
      const ur = await fetch("/api/upload", { method: "POST", body: fd });
      if (!ur.ok) { const e = await ur.json(); showToast(e.error ?? "Erreur upload", "error"); return; }
      const { url, fileName, fileSize, mimeType } = await ur.json();
      // 2. Créer le document en DB
      const dr = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fileUrl: url, fileName, fileSize, mimeType }),
      });
      if (!dr.ok) { showToast("Erreur création document", "error"); return; }
      const newDoc = await dr.json();
      setDocs((p) => [newDoc, ...p]);
      setForm({ title: "", description: "", type: "COURS", level: "DEBUTANT", icon: "📊" });
      setFile(null);
      setAdminTab("documents");
      showToast("Document ajouté avec succès ✅");
      if (stats) setStats({ ...stats, totalDocs: stats.totalDocs + 1 });
    } finally { setUploading(false); }
  }

  // ── Edit ──
  function openEdit(doc: Doc) {
    setEditDoc(doc);
    setEditForm({ title: doc.title, description: doc.description ?? "", type: doc.type, level: doc.level, icon: doc.icon });
  }
  async function handleEdit() {
    if (!editDoc) return;
    const r = await fetch(`/api/documents/${editDoc.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
    });
    if (!r.ok) { showToast("Erreur modification", "error"); return; }
    const updated = await r.json();
    setDocs((p) => p.map((d) => d.id === updated.id ? updated : d));
    setEditDoc(null);
    showToast("Document modifié ✅");
  }

  // ── Delete doc ──
  async function handleDelete(doc: Doc) {
    if (!confirm(`Supprimer « ${doc.title} » ? Cette action est irréversible.`)) return;
    const r = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!r.ok) { showToast("Erreur suppression", "error"); return; }
    setDocs((p) => p.filter((d) => d.id !== doc.id));
    showToast("Document supprimé 🗑️");
    if (stats) setStats({ ...stats, totalDocs: stats.totalDocs - 1 });
  }

  // ── Delete student ──
  async function handleDeleteStudent(s: Student) {
    if (!confirm(`Retirer l'étudiant(e) ${s.name} ?`)) return;
    const r = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    if (!r.ok) { showToast("Erreur suppression", "error"); return; }
    setStudents((p) => p.filter((st) => st.id !== s.id));
    showToast("Étudiant(e) retiré(e)");
  }

  // ── Filtered docs ──
  const filteredDocs = docs.filter((d) => {
    const q = search.toLowerCase();
    return (
      (!q || d.title.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q)) &&
      (!filterLevel || d.level === filterLevel) &&
      (!filterType || d.type === filterType)
    );
  });

  // ── Drag & Drop ──
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragover(false);
    const f = e.dataTransfer.files[0]; if (f) setFile(f);
  }

  // ══════════════════════════════════════════════════════════════
  return (
    <>
      <Head>
        <title>ExcelMaster — Prof. Ninon Hermellon</title>
        <meta name="description" content="Plateforme de cours Microsoft Excel du Professeur Ninon Hermellon" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>" />
      </Head>

      {/* ── NAV ── */}
      <nav className={s.nav}>
        <button className={s.brand} onClick={() => { if (!session) setView("home"); }}>
          <span className={s.brandIcon}>X</span>
          <span>ExcelMaster</span>
        </button>
        <div className={s.navLinks}>
          <button onClick={() => { if (!session) setView("home"); else if (role === "ADMIN") setView("admin"); else setView("student"); }}>Accueil</button>
          {session && role === "STUDENT" && <button onClick={() => setView("student")}>📚 Mes cours</button>}
          {session && role === "ADMIN" && <button onClick={() => setView("admin")}>🛡️ Admin</button>}
        </div>
        <div className={s.navRight}>
          {!session ? (
            <>
              <button className={s.btnGoogle} onClick={() => signIn("google")}>
                <GoogleIcon /> Connexion étudiant
              </button>
              <button className={s.btnPrimary} onClick={() => setAdminModal(true)}>Admin</button>
            </>
          ) : (
            <div className={s.userMenuWrap} ref={menuRef}>
              <button className={s.avatar} onClick={() => setUserMenu((v) => !v)}>
                {session.user?.image
                  ? <Image src={session.user.image} alt="" width={36} height={36} style={{ borderRadius: "50%" }} />
                  : <span>{initials(session.user?.name)}</span>}
              </button>
              {userMenu && (
                <div className={s.dropdown}>
                  <div className={s.dropdownHeader}>
                    <div className={s.dropdownName}>{session.user?.name}</div>
                    <div className={s.dropdownRole}>{role === "ADMIN" ? "🛡️ Administrateur" : "🎓 Étudiant"}</div>
                  </div>
                  <button className={s.dropdownItem} onClick={() => { setUserMenu(false); setView(role === "ADMIN" ? "admin" : "student"); }}>
                    {role === "ADMIN" ? "🛡️ Tableau de bord" : "📚 Mes cours"}
                  </button>
                  <button className={`${s.dropdownItem} ${s.dropdownDanger}`} onClick={handleLogout}>🚪 Déconnexion</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ══════════════ HOME ══════════════ */}
      {view === "home" && (
        <main>
          <div className={s.hero}>
            <div className={s.heroInner}>
              <div className={s.heroTag}>✦ Plateforme de cours officielle</div>
              <h1 className={s.heroTitle}>
                Maîtrisez <span className={s.heroAccent}>Microsoft Excel</span><br />
                avec Prof. Hermellon
              </h1>
              <p className={s.heroSub}>
                Une plateforme dédiée aux étudiants du Professeur Ninon Hermellon.
                Accédez à tous vos cours, livres et ressources pédagogiques en un seul endroit.
              </p>
              <div className={s.heroActions}>
                <button className={s.heroBtnMain} onClick={() => signIn("google")}>🎓 Accéder aux cours</button>
                <button className={s.heroBtnGhost} onClick={() => setAdminModal(true)}>🛡️ Espace professeur</button>
              </div>
            </div>
          </div>

          <div className={s.statsBar}>
            {[
              { num: "∞", label: "Ressources disponibles" },
              { num: "4", label: "Niveaux d'apprentissage" },
              { num: "100%", label: "Accès gratuit" },
              { num: "24/7", label: "Disponible partout" },
            ].map((st) => (
              <div key={st.label} className={s.statItem}>
                <div className={s.statNum}>{st.num}</div>
                <div className={s.statLabel}>{st.label}</div>
              </div>
            ))}
          </div>

          <div className={s.featuresSection}>
            <div className={s.sectionTitle}>Tout ce dont vous avez besoin</div>
            <div className={s.sectionSub}>Des ressources complètes pour maîtriser Excel de A à Z</div>
            <div className={s.featuresGrid}>
              {[
                { icon: "📚", title: "Cours Structurés", desc: "Des supports organisés par niveau, du débutant à l'expert, avec des exemples pratiques." },
                { icon: "📥", title: "Téléchargement Libre", desc: "Téléchargez tous les documents pour travailler hors connexion à votre rythme." },
                { icon: "🔒", title: "Accès Sécurisé", desc: "Connexion via Google pour un accès personnel et sécurisé à votre espace étudiant." },
                { icon: "📊", title: "Ressources Variées", desc: "Cours, livres, exercices pratiques, fiches récapitulatives et bien plus encore." },
              ].map((f) => (
                <div key={f.title} className={s.featureCard}>
                  <div className={s.featureIcon}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <footer className={s.footer}>
            <strong>ExcelMaster</strong> — Plateforme pédagogique du Professeur Ninon Hermellon · Tous droits réservés © {new Date().getFullYear()}
          </footer>
        </main>
      )}

      {/* ══════════════ STUDENT ══════════════ */}
      {view === "student" && session && (
        <main className={s.studentMain}>
          <div className={s.studentHeader}>
            <div>
              <h1>Bonjour, {session.user?.name?.split(" ")[0]} 👋</h1>
              <p>Bienvenue sur votre espace de cours — Prof. Ninon Hermellon</p>
            </div>
            <div className={s.studentAvatar}>
              {session.user?.image
                ? <Image src={session.user.image} alt="" width={64} height={64} style={{ borderRadius: "50%" }} />
                : <span>{initials(session.user?.name)}</span>}
            </div>
          </div>

          <div className={s.searchBar}>
            <input className={s.searchInput} placeholder="🔍  Rechercher un cours..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={s.filterSelect} value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
              <option value="">Tous les niveaux</option>
              {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className={s.filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {loading ? (
            <div className={s.loadingWrap}><div className={s.spinner} /><p>Chargement des cours...</p></div>
          ) : filteredDocs.length === 0 ? (
            <div className={s.emptyState}>😔 Aucun document trouvé</div>
          ) : (
            <div className={s.coursesGrid}>
              {filteredDocs.map((doc) => (
                <div key={doc.id} className={s.courseCard}>
                  <div className={s.courseThumb}>
                    <span className={`${s.courseLevel} ${levelClass(doc.level)}`}>{LEVEL_LABEL[doc.level]}</span>
                    <span className={s.courseEmoji}>{doc.icon}</span>
                  </div>
                  <div className={s.courseBody}>
                    <div className={`${s.courseType} ${typeBadge(doc.type)}`}>{TYPE_LABEL[doc.type]}</div>
                    <div className={s.courseTitle}>{doc.title}</div>
                    <div className={s.courseDesc}>{doc.description}</div>
                    <div className={s.courseFooter}>
                      <div className={s.courseMeta}>
                        📁 {doc.fileSize ?? "N/A"} · 📅 {fmtDate(doc.createdAt)}
                        {doc._count && <span> · ⬇ {doc._count.downloads}</span>}
                      </div>
                      <button className={s.btnDl} onClick={() => handleDownload(doc)}>⬇ Télécharger</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ══════════════ ADMIN ══════════════ */}
      {view === "admin" && session && role === "ADMIN" && (
        <main className={s.adminMain}>
          <div className={s.adminHeader}>
            <h1>🛡️ Tableau de Bord Administrateur</h1>
            <p>Gérez tous les contenus de la plateforme ExcelMaster</p>
          </div>

          {/* Stats */}
          {stats && (
            <div className={s.adminStats}>
              {[
                { num: stats.totalDocs, label: "Documents" },
                { num: stats.totalStudents, label: "Étudiants" },
                { num: stats.totalDownloads, label: "Téléchargements" },
                { num: stats.docsByType.find(t => t.type === "COURS")?._count.id ?? 0, label: "Cours" },
                { num: stats.docsByType.find(t => t.type === "LIVRE")?._count.id ?? 0, label: "Livres" },
                { num: stats.docsByType.find(t => t.type === "EXERCICE")?._count.id ?? 0, label: "Exercices" },
              ].map((st) => (
                <div key={st.label} className={s.adminStatCard}>
                  <div className={s.adminStatNum}>{st.num}</div>
                  <div className={s.adminStatLabel}>{st.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Admin Tabs */}
          <div className={s.adminTabs}>
            {(["documents", "upload", "students"] as const).map((tab) => (
              <button key={tab} className={`${s.adminTab} ${adminTab === tab ? s.adminTabActive : ""}`}
                onClick={() => setAdminTab(tab)}>
                {tab === "documents" ? "📁 Documents" : tab === "upload" ? "➕ Ajouter" : "👥 Étudiants"}
              </button>
            ))}
          </div>

          {/* ── Documents Tab ── */}
          {adminTab === "documents" && (
            <div className={s.card}>
              <div className={s.cardHeader}>
                <h3>Tous les documents ({docs.length})</h3>
                <button className={s.btnSmEdit} onClick={() => setAdminTab("upload")}>+ Ajouter</button>
              </div>
              {loading ? <div className={s.loadingWrap}><div className={s.spinner} /></div> : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead><tr><th>Document</th><th>Type</th><th>Niveau</th><th>Taille</th><th>Téléch.</th><th>Date</th><th>Actions</th></tr></thead>
                    <tbody>
                      {docs.map((doc) => (
                        <tr key={doc.id}>
                          <td><strong>{doc.icon} {doc.title}</strong></td>
                          <td><span className={`${s.badge} ${typeBadge(doc.type)}`}>{TYPE_LABEL[doc.type]}</span></td>
                          <td>{LEVEL_LABEL[doc.level]}</td>
                          <td>{doc.fileSize ?? "—"}</td>
                          <td>{doc._count?.downloads ?? 0}</td>
                          <td>{fmtDate(doc.createdAt)}</td>
                          <td>
                            <div className={s.actionBtns}>
                              <button className={s.btnSmEdit} onClick={() => openEdit(doc)}>✏️ Modifier</button>
                              <button className={s.btnSmDel} onClick={() => handleDelete(doc)}>🗑️ Supprimer</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Upload Tab ── */}
          {adminTab === "upload" && (
            <div className={s.card}>
              <div className={s.cardHeader}><h3>➕ Ajouter un nouveau document</h3></div>
              <div className={s.uploadForm}>
                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.label}>Titre du document *</label>
                    <input className={s.input} placeholder="Ex: Introduction à Excel"
                      value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.label}>Icône (emoji)</label>
                    <input className={s.input} maxLength={4} value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.label}>Type</label>
                    <select className={s.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.label}>Niveau</label>
                    <select className={s.input} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                      {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className={`${s.formGroup} ${s.formFull}`}>
                    <label className={s.label}>Description</label>
                    <textarea className={`${s.input} ${s.textarea}`} placeholder="Décrivez brièvement ce document..."
                      value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className={`${s.formGroup} ${s.formFull}`}>
                    <label className={s.label}>Fichier *</label>
                    <div
                      className={`${s.uploadZone} ${dragover ? s.uploadZoneDrag : ""}`}
                      onClick={() => fileRef.current?.click()}
                      onDrop={onDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                      onDragLeave={() => setDragover(false)}
                    >
                      <input ref={fileRef} type="file" style={{ display: "none" }}
                        accept=".pdf,.xlsx,.xls,.docx,.pptx,.zip,.txt,.csv"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                      <div className={s.uploadZoneIcon}>📂</div>
                      <p><strong>Cliquez pour sélectionner</strong> ou glissez-déposez</p>
                      <p className={s.uploadZoneSub}>PDF, Excel, Word, PowerPoint, ZIP — jusqu'à 50 Mo</p>
                      {file && <p className={s.uploadZoneFile}>📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} Mo)</p>}
                    </div>
                  </div>
                </div>
                <div className={s.formActions}>
                  <button className={s.btnCancel} onClick={() => { setForm({ title: "", description: "", type: "COURS", level: "DEBUTANT", icon: "📊" }); setFile(null); }}>Annuler</button>
                  <button className={s.btnSave} onClick={handleUpload} disabled={uploading}>
                    {uploading ? "⏳ Upload en cours..." : "💾 Enregistrer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Students Tab ── */}
          {adminTab === "students" && (
            <div className={s.card}>
              <div className={s.cardHeader}><h3>Étudiants inscrits ({students.length})</h3></div>
              {loading ? <div className={s.loadingWrap}><div className={s.spinner} /></div> : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead><tr><th>Nom</th><th>Email</th><th>Inscription</th><th>Dernière connexion</th><th>Téléch.</th><th>Actions</th></tr></thead>
                    <tbody>
                      {students.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--gray-500)" }}>Aucun étudiant inscrit</td></tr>}
                      {students.map((st) => (
                        <tr key={st.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {st.image ? <Image src={st.image} alt="" width={32} height={32} style={{ borderRadius: "50%" }} /> : <div className={s.miniAvatar}>{initials(st.name)}</div>}
                              <strong>{st.name}</strong>
                            </div>
                          </td>
                          <td>{st.email}</td>
                          <td>{fmtDate(st.createdAt)}</td>
                          <td>{st.lastLogin ? fmtDate(st.lastLogin) : "Jamais"}</td>
                          <td>{st._count?.downloads ?? 0}</td>
                          <td>
                            <button className={s.btnSmDel} onClick={() => handleDeleteStudent(st)}>🗑️ Retirer</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Activité récente ── */}
          {stats && stats.recentDownloads.length > 0 && (
            <div className={s.card} style={{ marginTop: 24 }}>
              <div className={s.cardHeader}><h3>⚡ Activité récente</h3></div>
              <div style={{ padding: "8px 0" }}>
                {stats.recentDownloads.map((dl, i) => (
                  <div key={i} className={s.activityRow}>
                    <div className={s.activityAvatar}>{initials(dl.user.name)}</div>
                    <div>
                      <strong>{dl.user.name}</strong> a téléchargé {dl.document.icon} <em>{dl.document.title}</em>
                      <div style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>{fmtDate(dl.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ══════════════ ADMIN LOGIN MODAL ══════════════ */}
      {adminModal && (
        <div className={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setAdminModal(false); }}>
          <div className={s.modal}>
            <button className={s.modalClose} onClick={() => setAdminModal(false)}>×</button>
            <div className={s.modalLogo}><span className={s.brandIcon} style={{ width: 44, height: 44, fontSize: "1.4rem" }}>X</span><div><div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800 }}>ExcelMaster</div><div style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>Prof. Ninon Hermellon</div></div></div>
            <h2 className={s.modalTitle}>🛡️ Espace Administrateur</h2>
            <p className={s.modalSub}>Accès réservé au Professeur Hermellon.</p>
            {adminErr && <div className={s.errorMsg}>{adminErr}</div>}
            <div className={s.formGroup}>
              <label className={s.label}>Identifiant administrateur</label>
              <input className={s.input} type="text" placeholder="Code administrateur"
                value={adminId} onChange={(e) => { setAdminId(e.target.value); setAdminErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()} />
            </div>
            <div className={s.formGroup}>
              <label className={s.label}>Mot de passe</label>
              <input className={s.input} type="password" placeholder="Mot de passe"
                value={adminPw} onChange={(e) => { setAdminPw(e.target.value); setAdminErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()} />
            </div>
            <button className={s.btnBlock} onClick={handleAdminLogin}>Se connecter</button>
          </div>
        </div>
      )}

      {/* ══════════════ EDIT MODAL ══════════════ */}
      {editDoc && (
        <div className={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setEditDoc(null); }}>
          <div className={s.modal}>
            <button className={s.modalClose} onClick={() => setEditDoc(null)}>×</button>
            <h2 className={s.modalTitle}>✏️ Modifier le document</h2>
            <div className={s.formGroup}>
              <label className={s.label}>Titre</label>
              <input className={s.input} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className={s.formGroup}>
              <label className={s.label}>Description</label>
              <textarea className={`${s.input} ${s.textarea}`} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Type</label>
                <select className={s.input} value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Niveau</label>
                <select className={s.input} value={editForm.level} onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}>
                  {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Icône</label>
                <input className={s.input} maxLength={4} value={editForm.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} />
              </div>
            </div>
            <div className={s.formActions}>
              <button className={s.btnCancel} onClick={() => setEditDoc(null)}>Annuler</button>
              <button className={s.btnSave} onClick={handleEdit}>💾 Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TOAST ══════════════ */}
      <div className={`${s.toast} ${toast.show ? s.toastShow : ""} ${toast.type === "error" ? s.toastError : ""}`}>
        {toast.msg}
      </div>

      <style jsx>{styles}</style>
    </>
  );
}

// ── Google Icon SVG ──
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ── CSS-in-JS (jsx) ──────────────────────────────────────────────
const s: Record<string, string> = {} as any;
const styles = `
  .nav{position:fixed;top:0;left:0;right:0;z-index:999;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1.5px solid var(--gray-200);display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:68px;box-shadow:var(--shadow-sm)}
  .brand{display:flex;align-items:center;gap:12px;font-family:Syne,sans-serif;font-weight:800;font-size:1.35rem;color:var(--green-deep);border:none;background:none;cursor:pointer}
  .brandIcon{width:40px;height:40px;background:var(--green-deep);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:900;color:white}
  .navLinks{display:flex;gap:4px}
  .navLinks button{padding:8px 16px;border-radius:8px;font-size:.92rem;font-weight:500;color:var(--gray-700);border:none;background:none;cursor:pointer;transition:all .2s}
  .navLinks button:hover{background:var(--green-pale);color:var(--green-deep)}
  .navRight{display:flex;align-items:center;gap:10px}
  .btnGoogle{display:flex;align-items:center;gap:8px;padding:9px 18px;border-radius:10px;background:white;border:1.5px solid var(--gray-200);font-size:.9rem;font-weight:500;cursor:pointer;transition:all .2s;color:var(--black)}
  .btnGoogle:hover{border-color:var(--green-mid);box-shadow:var(--shadow-sm)}
  .btnPrimary{padding:9px 20px;border-radius:10px;background:var(--green-deep);color:white;border:none;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .2s}
  .btnPrimary:hover{background:var(--green-mid);transform:translateY(-1px)}
  .avatar{width:36px;height:36px;border-radius:50%;background:var(--green-deep);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;cursor:pointer;border:none;padding:0;overflow:hidden}
  .userMenuWrap{position:relative}
  .dropdown{position:absolute;top:calc(100% + 8px);right:0;background:white;border:1.5px solid var(--gray-200);border-radius:var(--r);box-shadow:var(--shadow-md);min-width:200px;overflow:hidden;z-index:100;animation:fadeIn .15s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  .dropdownHeader{padding:14px 16px;border-bottom:1px solid var(--gray-100)}
  .dropdownName{font-weight:600;font-size:.9rem}
  .dropdownRole{font-size:.8rem;color:var(--gray-500);margin-top:2px}
  .dropdownItem{width:100%;padding:11px 16px;font-size:.9rem;color:var(--gray-700);cursor:pointer;border:none;background:none;text-align:left;display:flex;align-items:center;gap:8px;transition:background .15s}
  .dropdownItem:hover{background:var(--green-pale);color:var(--green-deep)}
  .dropdownDanger{color:var(--red)}
  .dropdownDanger:hover{background:#fde8e8;color:var(--red)}

  /* HERO */
  .hero{background:linear-gradient(135deg,var(--green-deep) 0%,#0f3d22 60%,#1a5c35 100%);padding:130px 40px 90px;position:relative;overflow:hidden}
  .hero::before{content:'';position:absolute;top:-80px;right:-80px;width:500px;height:500px;border-radius:50%;background:rgba(46,204,113,.07);pointer-events:none}
  .heroInner{max-width:860px;margin:0 auto;position:relative;z-index:1}
  .heroTag{display:inline-flex;align-items:center;gap:8px;background:rgba(46,204,113,.15);border:1px solid rgba(46,204,113,.3);color:var(--green-bright);padding:6px 14px;border-radius:20px;font-size:.82rem;font-weight:500;letter-spacing:.05em;margin-bottom:28px}
  .heroTitle{font-family:Syne,sans-serif;font-weight:800;font-size:clamp(2.2rem,5vw,3.6rem);color:white;line-height:1.15;margin-bottom:20px}
  .heroAccent{color:var(--green-bright)}
  .heroSub{color:rgba(255,255,255,.78);font-size:1.1rem;font-weight:300;line-height:1.7;max-width:560px;margin-bottom:40px}
  .heroActions{display:flex;gap:14px;flex-wrap:wrap}
  .heroBtnMain{padding:14px 28px;border-radius:12px;background:var(--green-bright);color:var(--black);border:none;font-size:1rem;font-weight:700;cursor:pointer;transition:all .25s}
  .heroBtnMain:hover{background:#25e065;transform:translateY(-2px);box-shadow:0 8px 24px rgba(46,204,113,.4)}
  .heroBtnGhost{padding:14px 28px;border-radius:12px;background:rgba(255,255,255,.12);color:white;border:1.5px solid rgba(255,255,255,.25);font-size:1rem;font-weight:600;cursor:pointer;transition:all .25s}
  .heroBtnGhost:hover{background:rgba(255,255,255,.2)}

  /* STATS */
  .statsBar{background:white;border-bottom:1.5px solid var(--gray-200);display:flex;flex-wrap:wrap}
  .statItem{flex:1;min-width:150px;padding:28px 40px;text-align:center;border-right:1.5px solid var(--gray-200)}
  .statItem:last-child{border-right:none}
  .statNum{font-family:Syne,sans-serif;font-size:2rem;font-weight:800;color:var(--green-deep)}
  .statLabel{font-size:.82rem;color:var(--gray-500);margin-top:2px}

  /* FEATURES */
  .featuresSection{max-width:1100px;margin:0 auto;padding:80px 40px}
  .sectionTitle{font-family:Syne,sans-serif;font-size:2rem;font-weight:800;margin-bottom:8px}
  .sectionSub{color:var(--gray-500);margin-bottom:48px}
  .featuresGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}
  .featureCard{background:white;border-radius:var(--rl);padding:32px 28px;border:1.5px solid var(--gray-200);transition:all .25s}
  .featureCard:hover{border-color:var(--green-bright);box-shadow:var(--shadow-md);transform:translateY(-3px)}
  .featureIcon{font-size:2rem;margin-bottom:16px}
  .featureCard h3{font-family:Syne,sans-serif;font-weight:700;font-size:1.05rem;margin-bottom:8px}
  .featureCard p{font-size:.9rem;color:var(--gray-500);line-height:1.65}
  .footer{background:var(--black);color:rgba(255,255,255,.55);text-align:center;padding:28px;font-size:.85rem}
  .footer strong{color:rgba(255,255,255,.85)}

  /* STUDENT */
  .studentMain{max-width:1100px;margin:0 auto;padding:100px 40px 60px}
  .studentHeader{background:linear-gradient(135deg,var(--green-deep),#0f3d22);border-radius:var(--rl);padding:36px 40px;color:white;margin-bottom:32px;display:flex;align-items:center;justify-content:space-between;gap:20px}
  .studentHeader h1{font-family:Syne,sans-serif;font-size:1.7rem;font-weight:800;margin-bottom:6px}
  .studentHeader p{color:rgba(255,255,255,.7);font-size:.92rem}
  .studentAvatar{width:64px;height:64px;border-radius:50%;background:var(--green-bright);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:800;color:var(--black);flex-shrink:0;overflow:hidden}
  .searchBar{display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap}
  .searchInput{flex:1;min-width:220px;padding:11px 16px;border-radius:11px;border:1.5px solid var(--gray-200);font-size:.95rem;outline:none;transition:border-color .2s;background:white}
  .searchInput:focus{border-color:var(--green-bright)}
  .filterSelect{padding:11px 16px;border-radius:11px;border:1.5px solid var(--gray-200);font-size:.9rem;outline:none;cursor:pointer;background:white;color:var(--black)}
  .coursesGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
  .courseCard{background:white;border-radius:var(--rl);overflow:hidden;border:1.5px solid var(--gray-200);transition:all .25s}
  .courseCard:hover{box-shadow:var(--shadow-md);transform:translateY(-3px);border-color:var(--green-light)}
  .courseThumb{height:140px;background:linear-gradient(135deg,var(--green-deep),var(--green-mid));display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
  .courseEmoji{font-size:3rem;position:relative;z-index:1}
  .courseLevel{position:absolute;top:12px;left:12px;padding:4px 10px;border-radius:6px;font-size:.75rem;font-weight:600}
  .levelA{background:var(--green-light);color:var(--green-deep)}
  .levelB{background:var(--gold);color:#7a5800}
  .levelC{background:#fde8e8;color:var(--red)}
  .levelD{background:#dbeafe;color:var(--blue)}
  .courseBody{padding:20px 22px}
  .courseType{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:inline-block;padding:3px 10px;border-radius:6px}
  .badgeGreen{background:var(--green-light);color:var(--green-deep)}
  .badgeBlue{background:#dbeafe;color:var(--blue)}
  .badgeGold{background:#fef3c7;color:#92400e}
  .badgeRed{background:#fde8e8;color:var(--red)}
  .courseTitle{font-family:Syne,sans-serif;font-weight:700;font-size:1rem;margin-bottom:8px;color:var(--black)}
  .courseDesc{font-size:.87rem;color:var(--gray-500);line-height:1.6;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .courseFooter{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--gray-100);padding-top:14px;gap:10px}
  .courseMeta{font-size:.78rem;color:var(--gray-500)}
  .btnDl{padding:8px 16px;border-radius:8px;background:var(--green-deep);color:white;border:none;font-size:.82rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all .2s;white-space:nowrap}
  .btnDl:hover{background:var(--green-mid);transform:scale(1.04)}
  .emptyState{text-align:center;padding:80px;color:var(--gray-500);font-size:1.1rem}

  /* ADMIN */
  .adminMain{max-width:1100px;margin:0 auto;padding:100px 40px 60px}
  .adminHeader{background:linear-gradient(135deg,var(--green-deep),#0f3d22);border-radius:var(--rl);padding:36px 40px;color:white;margin-bottom:28px}
  .adminHeader h1{font-family:Syne,sans-serif;font-size:1.8rem;font-weight:800;margin-bottom:6px}
  .adminHeader p{color:rgba(255,255,255,.7)}
  .adminStats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:28px}
  .adminStatCard{background:white;border-radius:var(--r);padding:22px 18px;border:1.5px solid var(--gray-200);text-align:center}
  .adminStatNum{font-family:Syne,sans-serif;font-size:2rem;font-weight:800;color:var(--green-deep)}
  .adminStatLabel{font-size:.8rem;color:var(--gray-500);margin-top:4px}
  .adminTabs{display:flex;gap:4px;background:var(--gray-100);border-radius:12px;padding:4px;margin-bottom:24px;width:fit-content}
  .adminTab{padding:10px 22px;border-radius:9px;font-size:.9rem;font-weight:500;cursor:pointer;border:none;background:transparent;color:var(--gray-500);transition:all .2s}
  .adminTabActive{background:white;color:var(--black);font-weight:600;box-shadow:var(--shadow-sm)}
  .card{background:white;border-radius:var(--rl);border:1.5px solid var(--gray-200);overflow:hidden}
  .cardHeader{padding:20px 24px;border-bottom:1.5px solid var(--gray-100);display:flex;align-items:center;justify-content:space-between}
  .cardHeader h3{font-family:Syne,sans-serif;font-weight:700;font-size:1rem}
  .tableWrap{overflow-x:auto}
  .table{width:100%;border-collapse:collapse}
  .table th{padding:13px 20px;text-align:left;font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--gray-500);background:var(--gray-100)}
  .table td{padding:14px 20px;border-top:1px solid var(--gray-100);font-size:.9rem;color:var(--gray-700);vertical-align:middle}
  .table tr:hover td{background:var(--green-pale)}
  .badge{padding:3px 10px;border-radius:6px;font-size:.75rem;font-weight:600}
  .actionBtns{display:flex;gap:6px}
  .btnSmEdit{padding:6px 12px;border-radius:7px;font-size:.8rem;font-weight:600;border:none;cursor:pointer;background:#dbeafe;color:var(--blue);transition:all .15s}
  .btnSmEdit:hover{background:#bfdbfe}
  .btnSmDel{padding:6px 12px;border-radius:7px;font-size:.8rem;font-weight:600;border:none;cursor:pointer;background:#fde8e8;color:var(--red);transition:all .15s}
  .btnSmDel:hover{background:#fecaca}
  .miniAvatar{width:32px;height:32px;border-radius:50%;background:var(--green-deep);color:white;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0}
  .activityRow{display:flex;align-items:flex-start;gap:12px;padding:14px 24px;border-top:1px solid var(--gray-100)}
  .activityRow:first-child{border-top:none}
  .activityAvatar{width:36px;height:36px;border-radius:50%;background:var(--green-deep);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0}

  /* UPLOAD FORM */
  .uploadForm{padding:28px 24px}
  .formRow{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .formFull{grid-column:1/-1}
  .formGroup{display:flex;flex-direction:column;gap:6px}
  .label{font-size:.85rem;font-weight:500;color:var(--gray-700)}
  .input{padding:11px 14px;border-radius:10px;border:1.5px solid var(--gray-200);font-size:.95rem;outline:none;transition:border-color .2s;background:white;color:var(--black)}
  .input:focus{border-color:var(--green-bright);box-shadow:0 0 0 3px rgba(46,204,113,.1)}
  .textarea{resize:vertical;min-height:90px}
  .uploadZone{border:2.5px dashed var(--gray-200);border-radius:var(--r);padding:40px;text-align:center;cursor:pointer;transition:all .2s;background:var(--gray-100)}
  .uploadZone:hover,.uploadZoneDrag{border-color:var(--green-bright);background:var(--green-pale)}
  .uploadZoneIcon{font-size:2.5rem;margin-bottom:12px}
  .uploadZone p{color:var(--gray-500);font-size:.9rem}
  .uploadZone strong{color:var(--green-deep)}
  .uploadZoneSub{font-size:.8rem;margin-top:6px}
  .uploadZoneFile{margin-top:10px;color:var(--green-deep);font-weight:600}
  .formActions{display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--gray-100);margin-top:16px}
  .btnCancel{padding:10px 20px;border-radius:10px;border:1.5px solid var(--gray-200);background:white;color:var(--gray-700);font-size:.9rem;font-weight:600;cursor:pointer}
  .btnSave{padding:10px 22px;border-radius:10px;background:var(--green-deep);color:white;border:none;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .2s}
  .btnSave:hover{background:var(--green-mid)}
  .btnSave:disabled{background:var(--gray-200);color:var(--gray-500);cursor:not-allowed}

  /* MODAL */
  .overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}
  .modal{background:white;border-radius:var(--rl);padding:44px 40px;width:100%;max-width:440px;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.22);animation:modalIn .25s ease}
  @keyframes modalIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
  .modalClose{position:absolute;top:16px;right:18px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--gray-500);line-height:1;padding:4px}
  .modalClose:hover{color:var(--black)}
  .modalLogo{display:flex;align-items:center;gap:12px;margin-bottom:24px}
  .modalTitle{font-family:Syne,sans-serif;font-size:1.5rem;font-weight:800;margin-bottom:6px}
  .modalSub{color:var(--gray-500);font-size:.9rem;margin-bottom:24px}
  .errorMsg{background:#fde8e8;color:var(--red);padding:10px 14px;border-radius:8px;font-size:.87rem;margin-bottom:14px}
  .btnBlock{width:100%;padding:13px;border-radius:11px;font-size:1rem;font-weight:600;border:none;cursor:pointer;background:var(--green-deep);color:white;transition:all .2s;margin-top:4px}
  .btnBlock:hover{background:var(--green-mid)}

  /* LOADING */
  .loadingWrap{display:flex;flex-direction:column;align-items:center;gap:16px;padding:60px;color:var(--gray-500)}
  .spinner{width:36px;height:36px;border:3px solid var(--gray-200);border-top-color:var(--green-deep);border-radius:50%;animation:spin .7s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* TOAST */
  .toast{position:fixed;bottom:28px;right:28px;z-index:9999;background:var(--black);color:white;padding:14px 22px;border-radius:12px;font-size:.9rem;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,.28);transform:translateY(80px);transition:transform .3s cubic-bezier(.34,1.56,.64,1);pointer-events:none}
  .toastShow{transform:translateY(0)}
  .toastError{background:var(--red)}

  /* RESPONSIVE */
  @media(max-width:768px){
    .nav{padding:0 16px}
    .navLinks{display:none}
    .hero{padding:90px 20px 60px}
    .adminMain,.studentMain{padding:88px 16px 40px}
    .formRow{grid-template-columns:1fr}
    .studentHeader{padding:24px 20px}
    .adminHeader{padding:24px 20px}
    .modal{padding:32px 22px}
    .table th,.table td{padding:10px 12px}
  }
`;
