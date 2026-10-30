# Déployer Data-Kick sur Oracle Cloud (gratuit) avec ton nom de domaine

Résultat : `https://ton-domaine.fr`, en ligne 24 h/24, HTTPS automatique, actualisation toutes les 3 h.

```text
ton-domaine.fr ──DNS──▶ VM Oracle (IP fixe)
                         ├─ Caddy       ports 80/443, HTTPS automatique  ──▶ 127.0.0.1:8000
                         ├─ server.py   service systemd (redémarre seul)
                         └─ PostgreSQL  Docker, accessible depuis la VM uniquement
```

Dans les commandes, remplace :
- `IP_DE_LA_VM` par l'IP publique de ta VM
- `ton-domaine.fr` par ton domaine
- `~/Téléchargements/ssh-key.key` par le chemin de ta clé SSH

---

## 0. Sur ton PC : tout pousser sur GitHub

La VM récupère le code depuis GitHub : il doit être à jour.

```bash
cd ~/Bureau/Projet/Data-Kick
git status          # rien ne doit rester "modified" ou "untracked" (sauf data/ et models/, ignorés)
git push
```

---

## 1. Créer le compte Oracle Cloud

1. Inscription sur https://www.oracle.com/cloud/free/ (une carte bancaire est demandée pour vérifier l'identité, rien n'est débité sur les ressources « Always Free »).
2. **Région d'origine** : choisis **France Central (Paris)** ou **France South (Marseille)**. Elle ne peut plus être changée ensuite.

---

## 2. Créer la machine virtuelle

Menu ☰ → **Compute** → **Instances** → **Create instance** :

| Réglage | Valeur |
|---|---|
| Name | `data-kick` |
| Image | **Canonical Ubuntu 24.04** |
| Shape | **Ampere → VM.Standard.A1.Flex**, 1 OCPU, 6 GB de mémoire (« Always Free-eligible ») |
| Networking | laisser par défaut, **Assign a public IPv4 address** coché |
| SSH keys | **Generate a key pair for me** → **Save private key** (garde ce fichier précieusement) |

→ **Create**. Après 1 à 2 minutes, l'instance est « Running » et affiche son **Public IP address**.

> **« Out of capacity »** : fréquent sur les machines Ampere gratuites. Réessaie plus tard ou change d'« Availability domain ». À défaut, prends **VM.Standard.E2.1.Micro** (AMD, 1 GB, aussi gratuite) et ajoute de la mémoire swap à l'étape 4.

**Fixer l'IP** (sinon elle peut changer et casser ton domaine) : sur la page de l'instance → **Attached VNICs** → la VNIC → **IPv4 Addresses** → ⋮ → **Edit** → **Reserved public IP** → créer une IP réservée.

---

## 3. Ouvrir les ports 80 et 443 (deux endroits)

**a) Dans Oracle** : page de l'instance → lien du **Subnet** → **Security Lists** → **Default Security List** → **Add Ingress Rules**, deux règles :

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

**b) Dans la VM** (piège classique d'Oracle : les images Ubuntu bloquent tout par défaut) → à l'étape suivante.

---

## 4. Se connecter et installer le nécessaire

Depuis ton PC :

```bash
chmod 600 ~/Téléchargements/ssh-key.key
ssh -i ~/Téléchargements/ssh-key.key ubuntu@IP_DE_LA_VM
```

Puis, **dans la VM** :

```bash
# Ports 80 et 443 ouverts dans le pare-feu de la VM, et gardés après redémarrage
# Les règles doivent être AVANT la ligne REJECT (sa position varie selon l'image : on la cherche)
REJECT_LINE=$(sudo iptables -L INPUT -n --line-numbers | awk '/REJECT/ {print $1; exit}')
sudo iptables -I INPUT "$REJECT_LINE" -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT "$REJECT_LINE" -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
sudo iptables -L INPUT -n --line-numbers   # 80 et 443 doivent apparaître au-dessus de REJECT

# Outils : git, Python, Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-venv docker.io docker-compose-v2
sudo usermod -aG docker ubuntu
exit
```

Reconnecte-toi (`ssh -i ... ubuntu@IP_DE_LA_VM`) pour que Docker soit utilisable sans `sudo`.

> Uniquement si tu as pris la VM **E2.1.Micro (1 GB)** : ajoute 2 GB de swap
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## 5. Récupérer le code

Ton dépôt est cloné en SSH : la VM a besoin de sa propre clé, en lecture seule.

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Copie la ligne affichée dans GitHub → dépôt **Data-Kick** → **Settings** → **Deploy keys** → **Add deploy key** (ne coche pas « Allow write access »). Puis :

```bash
git clone git@github.com:WahibDaoudi/Data-Kick.git
cd ~/Data-Kick
```

---

## 6. Base de données

**a) Fichier `.env` avec un mot de passe fort** (généré, jamais commité) :

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

**b) Transférer ta base locale** (matchs, équipes, pronos déjà enregistrés).

Sur **ton PC** :

```bash
cd ~/Bureau/Projet/Data-Kick
docker exec datakick_postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' > datakick.sql
scp -i ~/Téléchargements/ssh-key.key datakick.sql ubuntu@IP_DE_LA_VM:~/
rm datakick.sql
```

Dans la **VM** :

```bash
docker exec -i datakick_postgres sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ~/datakick.sql
docker exec datakick_postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM matches;"'
rm ~/datakick.sql
```

Le nombre de matchs doit être le même que chez toi (≈ 26 000).

---

## 7. Python et modèle

```bash
cd ~/Data-Kick
python3 -m venv .venv
.venv/bin/pip install -r requirements-prod.txt
cd src && ../.venv/bin/python train.py && cd ..
```

`train.py` recrée `models/model.joblib` (le dossier `models/` n'est pas dans Git).

---

## 8. Lancer le site en service (démarre au boot, redémarre seul)

```bash
sudo cp deploy/datakick.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now datakick
```

Vérification (attendre ~20 s le temps du premier téléchargement des résultats) :

```bash
systemctl status datakick --no-pager
curl -s "localhost:8000/api/fixtures?competition=F1" | head -c 200
```

Logs en direct : `journalctl -u datakick -f` (Ctrl+C pour quitter).

---

## 9. HTTPS avec Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/ton-domaine.fr/TON_VRAI_DOMAINE/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

(La copie dans `/etc/caddy` est modifiée, pas le fichier du dépôt : `git pull` reste propre.)

---

## 10. Nom de domaine

Chez ton registrar (OVH, Gandi, Namecheap, Cloudflare…), zone DNS de ton domaine :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `@` (domaine nu) | `IP_DE_LA_VM` |
| `A` | `www` | `IP_DE_LA_VM` |

Supprime les anciens enregistrements `A` / `AAAA` de `@` et `www` (souvent une page « parking » du registrar).
Cloudflare : mets le nuage en **gris (DNS only)** au début, le temps que Caddy obtienne son certificat.

La propagation prend de quelques minutes à quelques heures. Caddy réessaie tout seul : dès que le domaine pointe vers la VM, `https://ton-domaine.fr` fonctionne, certificat compris.

---

## Mettre à jour le site plus tard

Sur ton PC : commit + `git push`. Puis dans la VM :

```bash
~/Data-Kick/deploy/update.sh
```

Si tu changes du CSS ou du JS, pense à augmenter le `?v=N` dans `web/index.html` (sinon les visiteurs gardent l'ancienne version en cache).

---

## Sauvegarde automatique (recommandé)

Une copie de la base par jour, gardée 7 jours (une par jour de la semaine) :

```bash
crontab -e
```

Ajoute la ligne :

```text
0 4 * * * docker exec datakick_postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > /home/ubuntu/backup-$(date +\%u).sql.gz
```

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le site ne répond pas du tout | Port 80/443 fermé | Vérifier l'étape 3 (Security List **et** iptables) |
| Erreur 502 | `server.py` arrêté ou en démarrage | `journalctl -u datakick -n 50` |
| Pas de certificat HTTPS | DNS pas encore propagé, ou port 80 fermé | `journalctl -u caddy -n 50`, attendre la propagation |
| « RELANCE LE SERVEUR » sur le site | API en erreur | `journalctl -u datakick -n 50` |
| VM arrêtée par Oracle | Oracle peut récupérer les instances gratuites jugées inactives | Passer le compte en « Pay As You Go » : les ressources Always Free restent gratuites et ne sont plus récupérées |
