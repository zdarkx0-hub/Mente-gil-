# Mente Ágil para Android

Este diretório contém o contêiner Android do Mente Ágil.

- URL do aplicativo: https://mente-agil-vinicius.zdarkx0.chatgpt.site
- package id: `com.menteagil.app`
- versão: `1.1.1`
- Android mínimo: 7.0 (API 24)
- Android alvo: API 35

O APK abre o Mente Ágil em um WebView seguro, mantendo login, dados e funcionalidades no mesmo serviço publicado. Alterações no site passam a aparecer no aplicativo sem exigir recompilação do APK.

## Compilar

A GitHub Action `.github/workflows/android-apk.yml` gera automaticamente o APK instalável.
