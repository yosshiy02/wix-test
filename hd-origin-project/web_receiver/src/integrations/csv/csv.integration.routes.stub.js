/*
UNCONNECTED ROUTE STUB
- This file is NOT registered in server.js
- This file is NOT connected to existing routes
- This file is only a future API contract memo

Planned endpoints:
GET  /api/integrations/csv/profiles
POST /api/integrations/csv/preview
POST /api/integrations/csv/export
POST /api/integrations/csv/validate-import
POST /api/integrations/csv/import
GET  /api/integrations/csv/export-histories
GET  /api/integrations/csv/import-histories
*/

module.exports = {
  connected: false,
  note: 'Unconnected route stub. Do NOT register in server.js in this phase.',
  routes: [
    { method: 'GET', path: '/api/integrations/csv/profiles' },
    { method: 'POST', path: '/api/integrations/csv/preview' },
    { method: 'POST', path: '/api/integrations/csv/export' },
    { method: 'POST', path: '/api/integrations/csv/validate-import' },
    { method: 'POST', path: '/api/integrations/csv/import' },
    { method: 'GET', path: '/api/integrations/csv/export-histories' },
    { method: 'GET', path: '/api/integrations/csv/import-histories' }
  ]
};