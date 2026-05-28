#!/bin/bash
# Apex Solutions - macOS Downloader & Bootstrapper
# Run via: curl -fsSL https://raw.githubusercontent.com/Korisipati-Charan/Apex-Solutions/master/download-apex.sh | bash

set -e

# Visual Theme Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
MAGENTA='\033[0;35m'
RESET='\033[0m'
BOLD='\033[1m'

clear

# Beautiful Ascii Banner
echo -e "${BOLD}${CYAN}"
echo -e "  █████╗ ██████╗ ███████╗██╗  ██╗    ███████╗ ██████╗ ██╗     ██╗   ██╗████████╗██╗ ██████╗ ███╗   ██╗███████╗"
echo -e " ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝    ██╔════╝██╔═══██╗██║     ██║   ██║╚══██╔══╝██║██╔═══██╗████╗  ██║██╔════╝"
echo -e " ███████║██████╔╝█████╗   ╚███╔╝     ███████╗██║   ██║██║     ██║   ██║   ██║   ██║██║   ██║██╔██╗ ██║███████╗"
echo -e " ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗     ╚════██║██║   ██║██║     ██║   ██║   ██║   ██║██║   ██║██║╚██╗██║╚════██║"
echo -e " ██║  ██║██║     ███████╗██╔╝ ██╗    ███████║╚██████╔╝███████╗╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚████║███████║"
echo -e " ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝    ╚═╝   ╚═╝ ╚════╝ ╚═╝  ╚═══╝╚══════╝"
echo -e "${RESET}"
echo -e "${BOLD}${MAGENTA}=========================================================================================================${RESET}"
echo -e "${BOLD}${CYAN}                              Apex Solutions Standalone Downloader & Launcher                            ${RESET}"
echo -e "${BOLD}${MAGENTA}=========================================================================================================${RESET}\n"

REPO="Korisipati-Charan/Apex-Solutions"
FILENAME="Apex-Solutions.dmg"
DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$FILENAME"
TARGET_PATH="$HOME/Downloads/$FILENAME"

echo -e "${CYAN}[*] Targeting Latest Release Asset...${RESET}"
echo -e "${CYAN}[*] Download URL:${RESET} $DOWNLOAD_URL"
echo -e "${CYAN}[*] Destination Path:${RESET} $TARGET_PATH\n"

# Verify if destination file already exists
if [ -f "$TARGET_PATH" ]; then
    echo -e "${YELLOW}[!] An existing installation package was found in Downloads. Removing to fetch latest...${RESET}"
    rm -f "$TARGET_PATH"
fi

echo -e "${CYAN}[*] Initiating secure payload retrieval...${RESET}"
echo -e "${GREEN}[+] Downloading Apex Solutions Desktop Application DMG...${RESET}"

# Perform secure download with progress bar
if command -v curl >/dev/null 2>&1; then
    curl -L --progress-bar -o "$TARGET_PATH" "$DOWNLOAD_URL"
elif command -v wget >/dev/null 2>&1; then
    wget --show-progress -O "$TARGET_PATH" "$DOWNLOAD_URL"
else
    echo -e "${BOLD}\033[0;31m[x] Error: Neither curl nor wget was found on your system.${RESET}"
    exit 1
fi

echo -e "${GREEN}[+] Download successfully completed!${RESET}\n"

if [ -f "$TARGET_PATH" ]; then
    echo -e "${BOLD}${GREEN}[+] Download successfully verified! Setup complete!${RESET}\n"
    echo -e "${BOLD}${GREEN}[+] Opening the DMG Disk Image...${RESET}"
    echo -e "${CYAN}[*] Mount and drag the 'Apex Solutions.app' into your Applications folder.${RESET}\n"
    
    # Open the DMG file which triggers macOS native mounting UI
    open "$TARGET_PATH"
    
    echo -e "${BOLD}${GREEN}[+] Disk image opened successfully!${RESET}\n"
    read -p "[Press Enter to continue...]" < /dev/tty
else
    echo -e "${BOLD}\033[0;31m[x] Verification Error: DMG installer was not found after download.${RESET}\n"
    read -p "[Press Enter to continue...]" < /dev/tty
    exit 1
fi
