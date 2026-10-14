The release build (testground/build.sh) copies the sim (dist/forever → sim/), the testground page
(../web → web/) and a trimmed file list (listfile.csv) here before compiling, and they are embedded
into the program. In a plain checkout this folder only holds this file and the program serves those
from the repository instead.
