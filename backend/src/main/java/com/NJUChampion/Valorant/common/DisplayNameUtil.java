package com.NJUChampion.Valorant.common;

import com.NJUChampion.Valorant.entity.User;

/**
 * 用户展示名统一规则：游戏 ID（去掉 #tag 后缀）优先，其次用户名。
 * 与 TeamService.getDisplayName、UserVO.displayName 口径保持一致。
 */
public final class DisplayNameUtil {

    private DisplayNameUtil() {
    }

    public static String of(User user) {
        if (user == null) {
            return null;
        }
        String display = user.getDisplayGameId();
        return display != null && !display.isBlank() ? display : user.getUsername();
    }

    /** user 为 null 时返回 fallback，避免前端出现 "null" 文案 */
    public static String of(User user, String fallback) {
        String display = of(user);
        return display != null ? display : fallback;
    }
}
