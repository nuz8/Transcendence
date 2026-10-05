#!/usr/bin/env sh
set -eu

DIR="$1"
CN="$2"

[ -f "$DIR/cert.pem" ] || openssl req -x509 -nodes -days 365 \
	-newkey rsa:2048 \
	-keyout "$DIR/key.pem" \
	-out "$DIR/cert.pem" \
	-subj "/CN=$CN"
