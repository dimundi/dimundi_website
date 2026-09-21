<?php
// Only the HTTPS reverse proxy exposes this service.
$config['force_https'] = true;
$config['use_https'] = true;
$config['session_samesite'] = 'Lax';
$config['product_name'] = 'Dimundi Webmail';
$config['imap_conn_options'] = ['ssl' => [
    'verify_peer' => true,
    'verify_peer_name' => true,
    'allow_self_signed' => false,
]];
$config['smtp_conn_options'] = $config['imap_conn_options'];
