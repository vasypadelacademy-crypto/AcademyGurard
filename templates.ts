import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface TemplateField {
  name: string;
  key: string;
  type: 'string' | 'boolean' | 'number';
  required?: boolean;
  default?: any;
  description?: string;
}

export const EXPORT_TEMPLATES: Record<string, TemplateField[]> = {
  players: [
    { name: 'Athlete Name', key: 'name', type: 'string', required: true },
    { name: 'Email', key: 'email', type: 'string' },
    { name: 'Phone', key: 'phone', type: 'string' },
    { name: 'Level Name', key: 'levelName', type: 'string', description: 'Must match existing levels' },
    { name: 'Location Name', key: 'locationName', type: 'string', description: 'Must match existing locations' },
    { name: 'Group Code', key: 'groupCode', type: 'string', description: 'Must match existing group codes' },
    { name: 'Active (Y/N)', key: 'isActive', type: 'boolean', default: 'Y' },
    { name: 'Notes', key: 'notes', type: 'string' }
  ],
  packageTypes: [
    { name: 'Code', key: 'code', type: 'string', required: true },
    { name: 'Name', key: 'name', type: 'string', required: true }
  ],
  locations: [
    { name: 'Name', key: 'name', type: 'string', required: true },
    { name: 'GPS Link', key: 'gps', type: 'string' }
  ],
  levels: [
    { name: 'Name', key: 'name', type: 'string', required: true }
  ],
  groups: [
    { name: 'Code', key: 'code', type: 'string', required: true },
    { name: 'Name', key: 'name', type: 'string', required: true },
    { name: 'Color', key: 'color', type: 'string', default: '#3b82f6' },
    { name: 'Active (Y/N)', key: 'isActive', type: 'boolean', default: 'Y' }
  ],
  appUsers: [
    { name: 'Name', key: 'name', type: 'string', required: true },
    { name: 'Email', key: 'email', type: 'string', required: true },
    { name: 'Role', key: 'role', type: 'string', description: 'admin, coach, or visitor', required: true },
    { name: 'Active (Y/N)', key: 'isActive', type: 'boolean', default: 'Y' },
    { name: 'Initial Password', key: 'password', type: 'string', required: true }
  ]
};

export function downloadTemplate(type: keyof typeof EXPORT_TEMPLATES) {
  const fields = EXPORT_TEMPLATES[type];
  const header = fields.map(f => f.name);
  const example = fields.map(f => f.default || (f.type === 'string' ? `Example ${f.name}` : ''));
  
  const csv = Papa.unparse([header, example]);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${type}_template.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
