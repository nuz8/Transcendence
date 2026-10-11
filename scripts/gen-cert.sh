#!/usr/bin/env sh
set -eu

DIR="$1"
CN="$2"
SAN="${3:-DNS:$CN}"

# openssl prints IPs as "IP Address:x", while SAN uses "IP:x"
cert_has_all_sans() {
    san_text=$(openssl x509 -in "$DIR/cert.pem" -noout -ext subjectAltName 2>/dev/null) || return 1
    old_ifs=$IFS
    IFS=,
    for entry in $SAN; do
        case "$entry" in
            IP:*) needle="IP Address:${entry#IP:}" ;;
            *) needle="$entry" ;;
        esac
        if ! printf '%s\n' "$san_text" | grep -qF "$needle"; then
            IFS=$old_ifs
            return 1
        fi
    done
    IFS=$old_ifs
}

# Keep the existing cert only if it already contains every requested SAN entry.
if [ -f "$DIR/cert.pem" ] && cert_has_all_sans; then
    exit 0
fi

CONF=$(mktemp)
trap 'rm -f "$CONF"' EXIT

cat > "$CONF" <<EOF
[req]
distinguished_name = dn
x509_extensions = v3
prompt = no
[dn]
CN = $CN
[v3]
subjectAltName = $SAN
basicConstraints = CA:FALSE
EOF

openssl req -x509 -nodes -days 365 \
	-newkey rsa:2048 \
    -keyout "$DIR/key.pem" \
	-out "$DIR/cert.pem" \
	-config "$CONF"
	