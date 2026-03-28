# 🚀 Guide de Déploiement — ExcelMaster sur Vercel

> Temps estimé : **30 à 45 minutes** en suivant ce guide étape par étape.

---

## 📋 Vue d'ensemble de l'architecture

```
ExcelMaster
├── Frontend + API  →  Vercel (Next.js)
├── Base de données →  Supabase (PostgreSQL)
├── Stockage fichiers → Supabase Storage
└── Authentification → Google OAuth + NextAuth.js
```

---

## ÉTAPE 1 — Préparer le code sur GitHub

### 1.1 Installer Git et Node.js
- Téléchargez **Node.js 18+** : https://nodejs.org
- Téléchargez **Git** : https://git-scm.com

### 1.2 Créer un dépôt GitHub
1. Allez sur https://github.com → **New repository**
2. Nom : `excelmaster-hermellon`
3. Visibilité : **Private** (recommandé)
4. Cliquez **Create repository**

### 1.3 Pousser le code
```bash
# Dans le dossier du projet
cd excelmaster-hermellon
git init
git add .
git commit -m "Initial commit — ExcelMaster"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/excelmaster-hermellon.git
git push -u origin main
```

---

## ÉTAPE 2 — Créer la base de données Supabase

### 2.1 Créer un compte Supabase
1. Allez sur https://supabase.com → **Start your project**
2. Connectez-vous avec GitHub
3. Cliquez **New project**

### 2.2 Configurer le projet
- **Name** : `excelmaster-hermellon`
- **Database Password** : Choisissez un mot de passe fort (notez-le !)
- **Region** : `West EU (Ireland)` — le plus proche de l'Afrique
- Cliquez **Create new project** et attendez ~2 minutes

### 2.3 Récupérer les URLs de connexion
1. Dans Supabase → **Settings** (⚙️) → **Database**
2. Descendez jusqu'à **Connection string**
3. Choisissez l'onglet **URI**
4. Copiez l'URL en mode **Transaction** → c'est votre `DATABASE_URL`
   ```
   postgresql://postgres.XXXX:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
5. Copiez l'URL en mode **Session** → c'est votre `DIRECT_URL`
   ```
   postgresql://postgres.XXXX:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
   ```
   ⚠️ Remplacez `[YOUR-PASSWORD]` par votre mot de passe

### 2.4 Récupérer les clés API Supabase
1. Dans Supabase → **Settings** → **API**
2. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 2.5 Créer le bucket de stockage
1. Dans Supabase → **Storage** → **New bucket**
2. **Name** : `course-documents`
3. **Public bucket** : ✅ OUI (pour les téléchargements)
4. Cliquez **Create bucket**

### 2.6 Configurer les permissions du bucket
1. Dans **Storage** → `course-documents` → **Policies**
2. Cliquez **New policy** → **For full customization**
3. Créez cette politique :
   ```sql
   -- Permettre la lecture publique
   CREATE POLICY "Public read" ON storage.objects
   FOR SELECT USING (bucket_id = 'course-documents');

   -- Permettre l'upload aux admins (service role)
   CREATE POLICY "Service role upload" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'course-documents');
   ```

---

## ÉTAPE 3 — Configurer Google OAuth

### 3.1 Créer un projet Google Cloud
1. Allez sur https://console.cloud.google.com
2. Cliquez sur le sélecteur de projet en haut → **New Project**
3. **Name** : `ExcelMaster Hermellon`
4. Cliquez **Create**

### 3.2 Activer l'API Google OAuth
1. Dans le menu → **APIs & Services** → **OAuth consent screen**
2. **User Type** : External → **Create**
3. Remplissez :
   - **App name** : `ExcelMaster`
   - **User support email** : votre email
   - **Developer contact** : votre email
4. Cliquez **Save and Continue** (3 fois) → **Back to Dashboard**

### 3.3 Créer les credentials OAuth
1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
2. **Application type** : Web application
3. **Name** : `ExcelMaster Web`
4. **Authorized JavaScript origins** :
   ```
   http://localhost:3000
   https://votre-app.vercel.app
   ```
5. **Authorized redirect URIs** :
   ```
   http://localhost:3000/api/auth/callback/google
   https://votre-app.vercel.app/api/auth/callback/google
   ```
6. Cliquez **Create**
7. Copiez **Client ID** et **Client Secret**

---

## ÉTAPE 4 — Déployer sur Vercel

### 4.1 Créer un compte Vercel
1. Allez sur https://vercel.com → **Sign Up**
2. Connectez-vous avec **GitHub**

### 4.2 Importer le projet
1. Dans Vercel → **Add New** → **Project**
2. Trouvez `excelmaster-hermellon` → **Import**
3. **Framework Preset** : Next.js (détecté automatiquement)

### 4.3 Configurer les variables d'environnement
Dans la section **Environment Variables**, ajoutez une par une :

| Nom | Valeur |
|-----|--------|
| `NEXTAUTH_SECRET` | Générez avec : `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://votre-app.vercel.app` |
| `GOOGLE_CLIENT_ID` | Votre Google Client ID |
| `GOOGLE_CLIENT_SECRET` | Votre Google Client Secret |
| `DATABASE_URL` | URL Transaction Supabase |
| `DIRECT_URL` | URL Session Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase |
| `ADMIN_ID` | `26A980304` |
| `ADMIN_PASSWORD` | `Hermellon@13` |

### 4.4 Déployer
1. Cliquez **Deploy**
2. Attendez ~3 minutes
3. ✅ Votre site est en ligne !

### 4.5 Initialiser la base de données
Après le premier déploiement, la DB se crée automatiquement grâce à la commande dans `vercel.json` :
```
prisma generate && prisma db push && next build
```

Si besoin, lancez manuellement via le terminal Vercel ou localement :
```bash
npx prisma db push
```

---

## ÉTAPE 5 — Tester le déploiement

### ✅ Checklist de vérification

1. **Page d'accueil** : https://votre-app.vercel.app
   - [ ] La page s'affiche correctement
   
2. **Connexion Admin** :
   - [ ] Cliquez "Admin" → entrez `26A980304` / `Hermellon@13`
   - [ ] Le tableau de bord s'affiche
   
3. **Upload d'un document** :
   - [ ] Admin → "Ajouter" → remplissez le formulaire et uploadez un PDF
   - [ ] Le document apparaît dans la liste
   
4. **Connexion étudiant** :
   - [ ] Cliquez "Connexion étudiant" → Google OAuth
   - [ ] Les cours s'affichent
   
5. **Téléchargement** :
   - [ ] En tant qu'étudiant, cliquez "Télécharger" sur un cours
   - [ ] Le fichier se télécharge

---

## ÉTAPE 6 — Domaine personnalisé (optionnel)

Si vous voulez une URL comme `cours.hermellon.com` :

1. Dans Vercel → votre projet → **Settings** → **Domains**
2. Ajoutez votre domaine
3. Configurez les DNS chez votre registrar :
   ```
   Type: CNAME
   Name: cours
   Value: cname.vercel-dns.com
   ```

---

## 🔧 Développement local

Pour tester sur votre machine avant de déployer :

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier d'environnement
cp .env.example .env.local
# Remplissez .env.local avec vos vraies valeurs

# 3. Initialiser la base de données
npx prisma db push

# 4. Lancer le serveur de développement
npm run dev

# 5. Ouvrir http://localhost:3000
```

---

## 🆘 Dépannage fréquent

| Problème | Solution |
|----------|----------|
| Erreur de build Prisma | Vérifiez `DATABASE_URL` dans Vercel |
| Google OAuth échoue | Vérifiez les Authorized redirect URIs dans Google Cloud |
| Upload fichier échoue | Vérifiez que le bucket Supabase existe et est public |
| "Invalid session" | Régénérez `NEXTAUTH_SECRET` |
| La page reste blanche | Consultez les logs dans Vercel → Functions |

---

## 📞 Support

En cas de problème, consultez :
- Logs Vercel : votre-projet → **Functions** → cliquez une fonction
- Logs Supabase : votre-projet → **Logs**
- NextAuth debug : ajoutez `NEXTAUTH_DEBUG=true` dans les variables d'env

---

*Guide rédigé pour ExcelMaster — Plateforme du Professeur Ninon Hermellon*
