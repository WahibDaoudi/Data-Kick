# Déployer Data-Kick sur Google Cloud (gratuit) — datakick.duckdns.org

Même installation que sur Oracle (Docker, systemd, Caddy, DuckDNS), sur la machine **e2-micro gratuite à vie** de Google Cloud.

```text
datakick.duckdns.org ──DNS──▶ VM Google e2-micro (1 Go RAM, région USA)
                               ├─ Caddy       ports 80/443, HTTPS automatique ──▶ 127.0.0.1:8000
                               ├─ server.py   service systemd (redémarre seul)
                               ├─ PostgreSQL  Docker, accessible depuis la VM uniquement
                               └─ cron        met à jour l'IP sur DuckDNS toutes les 5 minutes
```

## Les 4 règles pour rester à 0 €

| Réglage | Valeur gratuite | Piège |
|---|---|---|
| Machine | **e2-micro** (une seule) | toute autre taille est payante |
| Région | **us-central1**, **us-west1** ou **us-east1** | l'Europe n'est **pas** gratuite |
| Disque | **Standard persistent disk**, 30 Go max | le défaut « Balanced » est **payant** |
| IP | IP éphémère + mise à jour automatique de DuckDNS | une IP fixe réservée peut être facturée |

Trafic sortant gratuit : 1 Go par mois (largement assez pour un site perso).

---

## 0. Sur ton PC : tout pousser sur GitHub

```bash
cd ~/Bureau/Projet/Data-Kick
git add src/ web/ deploy/ README.md
git commit -m "feat: La Liga, Serie A, live scores and Google Cloud deployment guide"
git push
```

---

## 1. Compte et alerte de budget

1. https://console.cloud.google.com → connexion avec ton compte Google → accepter l'essai (« Free trial », carte bancaire pour vérifier l'identité).
2. **Avant tout le reste**, l'alerte : menu ☰ → **Facturation** → **Budgets et alertes** → **Créer un budget** → montant **1 €** → alertes à 50 % et 100 % → ton e-mail.
3. Menu ☰ → **Compute Engine** → **Instances de VM** → **Activer** l'API (1 à 2 minutes).

---

## 2. Créer la machine

**Compute Engine** → **Instances de VM** → **Créer une instance** :

| Réglage | Valeur |
|---|---|
| Nom | `data-kick` |
| Région | **us-central1 (Iowa)** (ou us-west1 / us-east1) |
| Série / Type de machine | **E2** → **e2-micro** (2 vCPU partagés, 1 Go) |
| Disque de démarrage → **Modifier** | Image **Ubuntu 24.04 LTS (x86/64)**, Type **Disque persistant standard**, Taille **30 Go** |
| Pare-feu | cocher **Autoriser le trafic HTTP** et **Autoriser le trafic HTTPS** |

→ **Créer**. Le prix estimé à droite doit afficher la mention de l'offre gratuite (« free tier »).
Note l'**IP externe** affichée dans la liste des instances.

Pas de pare-feu à ouvrir dans Ubuntu : sur Google Cloud, les deux cases ci-dessus suffisent.

---

## 3. Se connecter

Dans la liste des instances, bouton **SSH** sur la ligne `data-kick` : un terminal s'ouvre dans le navigateur, déjà connecté. Toutes les commandes suivantes se tapent dans cette fenêtre.

---

## 4. Préparer la machine

```bash
# 2 Go de swap : la machine n'a que 1 Go de mémoire
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Outils : git, Python, Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-venv docker.io docker-compose-v2
sudo usermod -aG docker $USER
```

Ferme la fenêtre SSH et rouvre-la (bouton **SSH**) pour que Docker marche sans `sudo`. Vérifie : `docker ps` doit répondre sans erreur.

---

## 5. Récupérer le code

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

GitHub → dépôt **Data-Kick** → **Settings** → **Deploy keys** → **Add deploy key** → colle la ligne (sans cocher « Allow write access »). L'ancienne clé `oracle-vm` peut être supprimée.

```bash
git clone git@github.com:WahibDaoudi/Data-Kick.git
cd ~/Data-Kick
ls deploy        # Caddyfile  datakick.service  update.sh ...
```

---

## 6. Base de données

**a) `.env` avec un mot de passe fort, puis PostgreSQL :**

```bash
cd ~/Data-Kick
PASS=$(openssl rand -hex 24)
cat > .env <<EOF
POSTGRES_USER=datakick
POSTGRES_PASSWORD=$PASS
POSTGRES_DB=datakick
DATABASE_URL=postgresql://datakick:$PASS@localhost:5432/datakick
EOF
chmod 600 .env
docker compose up -d
```

**b) Exporter ta base depuis ton PC** (terminal de ton PC) :

```bash
cd ~/Bureau/Projet/Data-Kick
docker exec datakick_postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' > datakick.sql
```

**c) L'envoyer sur la VM** : dans la fenêtre SSH du navigateur, bouton **⚙ / Importer un fichier** (« Upload file ») → choisis `datakick.sql`. Il arrive dans ton dossier personnel de la VM.

**d) L'importer** (fenêtre SSH) :

```bash
docker exec -i datakick_postgres sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ~/datakick.sql
docker exec datakick_postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM matches;"'
rm ~/datakick.sql
```

Le nombre de matchs doit être le même que sur ton PC (≈ 26 000 ou plus).

---

## 7. Python et modèle

```bash
cd ~/Data-Kick
python3 -m venv .venv
.venv/bin/pip install -r requirements-prod.txt
cd src && ../.venv/bin/python train.py && cd ..
ls models        # model.joblib
```

---

## 8. Le site en service permanent

Sur Google Cloud, l'utilisateur n'est pas `ubuntu` mais ton nom Google : le fichier de service est adapté au passage.

```bash
cd ~/Data-Kick
sed "s#/home/ubuntu#$HOME#g; s#User=ubuntu#User=$USER#" deploy/datakick.service | sudo tee /etc/systemd/system/datakick.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now datakick
```

Attends ~30 secondes, puis :

```bash
systemctl status datakick --no-pager
curl -s "localhost:8000/api/fixtures?competition=F1" | head -c 200
```

---

## 9. DuckDNS : nouvelle IP, mise à jour automatique

1. Sur https://www.duckdns.org, copie ton **token** (en haut de la page, sous ton compte).
2. Dans la VM (remplace `TON_TOKEN`) :

```bash
mkdir -p ~/duckdns
cat > ~/duckdns/update.sh <<'EOF'
#!/usr/bin/env bash
# Sends the current public IP of this VM to DuckDNS (the IP changes when the VM restarts)
curl -s "https://www.duckdns.org/update?domains=datakick&token=TON_TOKEN&ip=" -o ~/duckdns/last.log
EOF
chmod 700 ~/duckdns/update.sh
~/duckdns/update.sh && cat ~/duckdns/last.log      # doit afficher OK
(crontab -l 2>/dev/null; echo "*/5 * * * * $HOME/duckdns/update.sh") | crontab -
```

`datakick.duckdns.org` pointe maintenant vers la VM Google, et suivra l'IP toute seule après chaque redémarrage.
Vérifie depuis ton PC : `dig +short datakick.duckdns.org` doit donner l'IP externe de la VM.

---

## 10. HTTPS avec Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
datakick.duckdns.org {
	encode gzip
	reverse_proxy 127.0.0.1:8000
}
EOF
sudo systemctl reload caddy
```

Une minute plus tard : **https://datakick.duckdns.org** 🎉

---

## Mettre à jour le site plus tard

PC : commit + `git push`. Puis dans la fenêtre SSH de la VM :

```bash
~/Data-Kick/deploy/update.sh
```

## Sauvegarde automatique (recommandé)

```bash
(crontab -l; echo "0 4 * * * docker exec datakick_postgres sh -c 'pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"' | gzip > $HOME/backup-\$(date +\%u).sql.gz") | crontab -
```

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le site ne répond pas | Cases HTTP/HTTPS non cochées | Instance → **Modifier** → Pare-feu → cocher les deux |
| Erreur 502 | `server.py` arrêté ou en démarrage | `journalctl -u datakick -n 50` |
| Pas de certificat HTTPS | DuckDNS pas encore sur la nouvelle IP | `cat ~/duckdns/last.log`, `journalctl -u caddy -n 30` |
| Lent ou plantages | Mémoire saturée (1 Go) | `free -h` : le swap doit apparaître (étape 4) |
| Facture | Mauvais disque, région ou type de machine | Vérifier le tableau « 4 règles » ; l'alerte budget prévient dès 0,50 € |
