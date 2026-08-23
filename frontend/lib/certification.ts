// 认证类型配置（与后端 CertificationType 枚举保持一致）。
// 新增认证类型时，在此加一条配置，并同步后端枚举。
export interface CertTypeDef {
  code: string;
  label: string;
  needsStudentInfo: boolean;
  group: string;
  isRank: boolean;
}

export const CERT_TYPES: CertTypeDef[] = [
  { code: "STUDENT", label: "在校生", needsStudentInfo: true, group: "identity", isRank: false },
  { code: "ALUMNI", label: "校友", needsStudentInfo: false, group: "identity", isRank: false },
  { code: "RANK", label: "段位", needsStudentInfo: false, group: "rank", isRank: true },
  { code: "REFEREE", label: "裁判", needsStudentInfo: false, group: "referee", isRank: false },
];

export function certTypeLabel(code: string): string {
  return CERT_TYPES.find((t) => t.code === code)?.label || code;
}
