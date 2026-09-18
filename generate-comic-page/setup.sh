#!/usr/bin/env bash
# generate-comic-page setup: nothing to download — only checks the external
# tools and the font the skill needs. Safe to re-run.
command -v higgsfield >/dev/null \
    && echo "higgsfield CLI: $(higgsfield --version 2>/dev/null | head -1)" \
    || echo "WARNING: higgsfield CLI not found — npm i -g @higgsfield/cli && higgsfield auth login"
flatpak info org.gimp.GIMP >/dev/null 2>&1 \
    && echo "flatpak GIMP: ok" \
    || echo "WARNING: flatpak org.gimp.GIMP not found — every page is delivered as .xcf (or set GIMP_CMD)"
fc-list | grep -qi "CCWildWords" \
    && echo "CCWildWords font: ok" \
    || echo "WARNING: CCWildWords font not installed — balloon text would fall back to GIMP's default font"
