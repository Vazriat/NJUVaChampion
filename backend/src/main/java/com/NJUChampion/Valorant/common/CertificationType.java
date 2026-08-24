package com.NJUChampion.Valorant.common;

/**
 * 认证类型元数据。新增认证类型时在此加一个枚举值，并同步前端 CERT_TYPES 配置。
 */
public enum CertificationType {
    STUDENT("STUDENT", "在校生", true, true, "identity", false),
    ALUMNI("ALUMNI", "校友", false, true, "identity", false),
    RANK("RANK", "段位", false, false, "rank", true),
    REFEREE("REFEREE", "裁判", false, false, "referee", false);

    private final String code;
    private final String label;
    /** 是否要求填写姓名 + 学号 */
    private final boolean needsStudentInfo;
    /** 是否要求填写入学年份（在校生/校友） */
    private final boolean needsEnrollmentYear;
    /** 互斥组：同一组内只能有一个活跃（PENDING/APPROVED）认证 */
    private final String group;
    /** 是否段位认证（审核通过后写入 User.verifiedRank） */
    private final boolean rank;

    CertificationType(String code, String label, boolean needsStudentInfo, boolean needsEnrollmentYear, String group, boolean rank) {
        this.code = code;
        this.label = label;
        this.needsStudentInfo = needsStudentInfo;
        this.needsEnrollmentYear = needsEnrollmentYear;
        this.group = group;
        this.rank = rank;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public boolean isNeedsStudentInfo() {
        return needsStudentInfo;
    }

    public boolean isNeedsEnrollmentYear() {
        return needsEnrollmentYear;
    }

    public String getGroup() {
        return group;
    }

    public boolean isRank() {
        return rank;
    }

    public static CertificationType fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (CertificationType t : values()) {
            if (t.code.equals(code)) {
                return t;
            }
        }
        return null;
    }
}
