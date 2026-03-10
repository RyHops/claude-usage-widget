/**
 * Create a Windows Start Menu shortcut for the app (run from source).
 * This makes "Claude Usage Widget" searchable in Windows Search/Start.
 *
 * Run: node scripts/create-shortcut.js
 *   or: npm run shortcut
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform !== 'win32') {
  console.log('This script is Windows-only. On macOS, drag the built .app to Applications.');
  process.exit(0);
}

const projectDir = path.resolve(__dirname, '..');
const electronExe = path.join(projectDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconPath = path.join(projectDir, 'assets', 'icon.ico');
const startMenuDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
const shortcutPath = path.join(startMenuDir, 'Claude Usage Widget.lnk');

if (!fs.existsSync(electronExe)) {
  console.error('electron.exe not found. Run "npm install" first.');
  process.exit(1);
}

// PowerShell script to create the .lnk shortcut via COM object
const psScript = [
  "$WshShell = New-Object -ComObject WScript.Shell",
  "$s = $WshShell.CreateShortcut('" + shortcutPath + "')",
  "$s.TargetPath = '" + electronExe + "'",
  "$s.Arguments = '.'",
  "$s.WorkingDirectory = '" + projectDir + "'",
  "$s.IconLocation = '" + iconPath + "'",
  "$s.Description = 'Claude Usage Widget'",
  "$s.Save()",
].join('; ');

try {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], { stdio: 'pipe' });
  console.log('Shortcut created:');
  console.log('  ' + shortcutPath);
  console.log('');
  console.log('You can now search "Claude Usage Widget" in the Windows Start Menu.');
} catch (err) {
  console.error('Failed to create shortcut:', err.message);
  process.exit(1);
}
