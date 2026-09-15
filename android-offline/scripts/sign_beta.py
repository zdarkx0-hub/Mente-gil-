#!/usr/bin/env python3
"""Sign a beta locally with its existing private key; never generate a new key."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile


def run(command, binary=False):
    result = subprocess.run(command, capture_output=True, text=not binary)
    if result.returncode:
        raise ValueError(f"Falha em {Path(command[0]).name}; nenhuma entrega foi criada.")
    return result.stdout


def apk_metadata(aapt2, apk):
    output = run([str(aapt2), "dump", "badging", str(apk)])
    package = next((line for line in output.splitlines() if line.startswith("package: ")), "")
    fields = dict(re.findall(r"(\w+)='([^']*)'", package))
    if not all(key in fields for key in ("name", "versionCode", "versionName")):
        raise ValueError("Não foi possível verificar o manifesto do APK.")
    return {
        "applicationId": fields["name"],
        "versionCode": int(fields["versionCode"]),
        "versionName": fields["versionName"],
        "debuggable": "application-debuggable" in output.splitlines(),
    }


def validate_release(candidate, identity, previous=None):
    if candidate["applicationId"] != identity["applicationId"]:
        raise ValueError("Identificador diferente da beta permanente.")
    if candidate["debuggable"]:
        raise ValueError("Uma versão de depuração não pode ser entregue como beta.")
    if candidate["versionCode"] < identity["firstVersionCode"]:
        raise ValueError("VersionCode anterior à linha beta permanente.")
    if previous is None:
        if candidate["versionCode"] != identity["firstVersionCode"]:
            raise ValueError("Informe o último APK entregue em --previous-apk.")
    else:
        if previous["applicationId"] != identity["applicationId"] or previous["debuggable"]:
            raise ValueError("O APK anterior não pertence à linha beta permanente.")
        if candidate["versionCode"] <= previous["versionCode"]:
            raise ValueError("A atualização precisa aumentar o versionCode.")


def verify_signature(apksigner, apk, expected):
    output = run(["java", "-jar", str(apksigner), "verify", "--verbose", "--print-certs",
                  "--min-sdk-version", "26", str(apk)])
    fingerprints = re.findall(r"Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]+)", output)
    if [fingerprint.lower() for fingerprint in fingerprints] != [expected.lower()]:
        raise ValueError("A assinatura não corresponde ao certificado fixo da beta.")
    if "Verified using v2 scheme (APK Signature Scheme v2): true" not in output:
        raise ValueError("Assinatura APK v2 ausente.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("input", "output", "apksigner", "aapt2", "keystore", "password-file"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--previous-apk", type=Path)
    args = parser.parse_args()
    identity = json.loads((Path(__file__).resolve().parents[1] / "release-identity.json").read_text())
    for source in (args.input, args.apksigner, args.aapt2, args.keystore, args.password_file):
        if not source.is_file():
            raise ValueError("Um arquivo necessário para a assinatura não foi encontrado.")
    output = args.output.resolve()
    checksum = output.with_suffix(output.suffix + ".sha256")
    if output.exists() or checksum.exists():
        raise ValueError("O arquivo de destino já existe; não será substituído.")
    previous = None
    if args.previous_apk:
        verify_signature(args.apksigner, args.previous_apk, identity["certificateSha256"])
        previous = apk_metadata(args.aapt2, args.previous_apk)
    candidate = apk_metadata(args.aapt2, args.input)
    validate_release(candidate, identity, previous)
    certificate = run(["keytool", "-exportcert", "-alias", identity["keyAlias"],
                       "-keystore", str(args.keystore), "-storepass:file", str(args.password_file)], binary=True)
    if hashlib.sha256(certificate).hexdigest() != identity["certificateSha256"]:
        raise ValueError("Chave incorreta. Recupere a chave existente; não gere outra.")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="beta-sign-", dir=output.parent) as work:
        signed = Path(work) / "signed.apk"
        run(["java", "-jar", str(args.apksigner), "sign", "--ks", str(args.keystore),
             "--ks-key-alias", identity["keyAlias"],
             "--ks-pass", "file:" + str(args.password_file),
             # PKCS12 uses the store password for its key. Passing the same file
             # twice makes apksigner consume a second (nonexistent) password line.
             "--min-sdk-version", "26", "--v1-signing-enabled", "true",
             "--v2-signing-enabled", "true", "--v3-signing-enabled", "true",
             "--v4-signing-enabled", "false", "--out", str(signed), str(args.input)])
        verify_signature(args.apksigner, signed, identity["certificateSha256"])
        if apk_metadata(args.aapt2, signed) != candidate:
            raise ValueError("O manifesto mudou durante a assinatura.")
        digest = hashlib.sha256(signed.read_bytes()).hexdigest()
        signed.replace(output)
        checksum.write_text(f"{digest}  {output.name}\n")
    print(json.dumps({**candidate, "certificateSha256": identity["certificateSha256"],
                      "sha256": digest, "output": str(output),
                      "previousVersionCode": previous["versionCode"] if previous else None}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
