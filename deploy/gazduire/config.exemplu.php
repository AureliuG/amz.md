<?php
// Setările Nobil Prest pe găzduirea web. Se modifică din cPanel → File Manager → config.php → Edit.
// Pachetul generat de scripts/pachet-gazduire.sh conține deja un config.php completat.
return [
    // Codul de acces pentru birou (vede tot). Gol = aplicația e deschisă oricui are adresa.
    'cod_birou' => 'SCHIMBATI',
    // Cod separat pentru șoferi (văd doar pagina Șofer). Gol = șoferii intră cu codul biroului.
    'cod_sofer' => '',
    // Cheia pentru furnizorul GPS: trimite pozițiile la /api/gps cu antetul "Authorization: Bearer <cheie>".
    'cheie_gps' => '',
    // Valoare secretă aleatorie. Schimbați-o ca să fie deconectată toată lumea.
    'sare' => 'SCHIMBATI-CU-CEVA-LUNG-SI-ALEATORIU',
    // Folderul cu date. Gol = automat, în afara site-ului (ex. /home/<cont>/nobilprest-date-delivery).
    'date' => '',
];
