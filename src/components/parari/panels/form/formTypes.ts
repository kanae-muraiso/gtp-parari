// src/components/parari/panels/form/formTypes.ts
// 2026/08/15 11:20

export type FormPanelData = {
  formId: string | null;
};

export type FormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "checkbox";

export type FormFieldWidth =
  | "full"
  | "half";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  width?: FormFieldWidth;
  rows?: number;
  options?: string[];
};

export type FormDefinitionData = {
  fields: FormField[];
};
