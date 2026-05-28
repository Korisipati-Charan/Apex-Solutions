# Apex Solutions

Apex Solutions is a standalone desktop application designed for creating, persisting, and conducting technical developer assessments. It provides a secure, offline-first environment to compile custom examination modules from raw documentation and evaluate candidate competency metrics locally.

---

## 💾 Installation & Setup

Get the application installed and running instantly on your machine using one of the following methods:

### Method 1: Automated Terminal Downloader (Recommended)

Copy and run the command below for your operating system to automatically download and launch the latest pre-compiled standalone package:

#### 🪟 Windows (PowerShell)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; cd $HOME; irm https://raw.githubusercontent.com/Korisipati-Charan/Apex-Solutions/master/download-apex.ps1 | iex
```

#### 🍎 macOS (Terminal)
```bash
cd ~ && curl -fsSL https://raw.githubusercontent.com/Korisipati-Charan/Apex-Solutions/master/download-apex.sh | bash
```

### Method 2: Manual Direct Downloads

If you prefer to download the packages manually, use the release installer buttons below:

<div align="center">
<table>
  <thead>
    <tr>
      <th align="center">Platform</th>
      <th align="center">Format</th>
      <th align="center">Download Link</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center">
        <b>Windows</b><br/>
        <img src="https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows"/>
      </td>
      <td align="center">Portable Executable (<code>.exe</code>)</td>
      <td align="center">
        <a href="https://github.com/Korisipati-Charan/Apex-Solutions/releases/latest/download/Apex-Solutions.exe">
          <img src="https://img.shields.io/badge/Download_for_Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows App"/>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center">
        <b>macOS</b><br/>
        <img src="https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS"/>
      </td>
      <td align="center">Disk Image (<code>.dmg</code>)</td>
      <td align="center">
        <a href="https://github.com/Korisipati-Charan/Apex-Solutions/releases/latest/download/Apex-Solutions.dmg">
          <img src="https://img.shields.io/badge/Download_for_macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS App"/>
        </a>
      </td>
    </tr>
  </tbody>
</table>

> [!NOTE]
> **GitHub Release Assets**: The download options pull binaries from the repository's latest GitHub Release. Once a release has been published, these direct buttons and automated scripts will activate immediately. You can check current release packages on the [Releases Page](https://github.com/Korisipati-Charan/Apex-Solutions/releases).
</div>

---

## ✨ Features

*   **Custom Assessment Builder**: Compile custom evaluation modules from local documentation (PDFs, Word, or plain text).
*   **Offline Persistence**: Complete local progress saving and recovery without network dependencies.
*   **Markdown Export**: Download full exam papers, question sheets, and answer keys as markdown files.
*   **Performance Scorecards**: Review detailed competency graphs and performance metrics locally.

## 🎹 Keyboard Navigation

Navigate the assessment interface smoothly using these keyboard shortcuts:
- <kbd>P</kbd> or <kbd>←</kbd> : Previous Question
- <kbd>N</kbd> or <kbd>→</kbd> : Next Question
- <kbd>Enter</kbd> : Confirm Selection
