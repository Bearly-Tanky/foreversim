FOREVER SIM {{VERSION}}
=======================

The WoW Forever simulator and 3D testground in one program: sim your character's gear and
talents, try it on in 3D, replay a simulated fight, or practise the rotation yourself.

You need World of Warcraft with Forever installed (through the Battle.net launcher). The program
reads models, textures and sounds from your own install; nothing from Blizzard is in this download.


STARTING IT
-----------
Windows:  double-click ForeverSim.exe.
          The first time, Windows may say "Windows protected your PC" because the program is not
          signed. Click "More info", then "Run anyway".

Linux:    run ./ForeverSim in a terminal (or double-click it, if your file manager runs programs).
          If it will not start: chmod +x ForeverSim

A small window opens and your browser shows the app at http://127.0.0.1:8090/. Keep the window
open while you use it; close it to quit. It only listens on your own computer.

The first time, it looks for World of Warcraft by itself. If it cannot find it, it asks for the
folder: the one that holds "_classic_beta_" (or "_classic_"), usually
  C:\Program Files (x86)\World of Warcraft
You can change it later with "Game folder" at the bottom of the sidebar.


USING IT
--------
1. Click "Open the sim" and set up your character: gear, talents, rotation, buffs.
2. Go back to the testground ("3D Testground" at the top of the sim):
   - Practice: play the fight yourself, then compare with the sim's rotation.
   - Gear: see your character in 3D.
   - Replay: watch one simulated fight.
   - Items: look at any item.

Practice keys: 1 to = and Shift+1 to = for abilities, T auto attack, Esc pause,
W/S move, A/D turn, Q/E strafe, Space jump, mouse drag to look (right button turns you).


UPDATES
-------
When there is a new version, the sidebar shows "Update to ...". Click it: the program downloads
the new version, replaces itself and restarts. Put the folder somewhere you can write to (your
Desktop or Documents, not Program Files) so it can.

Your settings and downloaded game data are kept in:
  Windows:  %APPDATA%\ForeverSim
  Linux:    ~/.config/ForeverSim
