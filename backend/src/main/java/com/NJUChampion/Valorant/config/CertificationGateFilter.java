package com.NJUChampion.Valorant.config;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.CertificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * 身份认证门槛过滤器：普通用户必须通过在校生/校友身份认证才能使用平台业务功能。
 * 未通过认证时访问白名单之外的接口返回 403 + Result{code:40301}。
 * 判定实时查 certifications 表，审核通过后立即生效，无需重新登录。
 */
@Component
@RequiredArgsConstructor
public class CertificationGateFilter extends OncePerRequestFilter {

    private final CertificationService certificationService;
    private final ObjectMapper objectMapper;

    /** 未通过身份认证的用户仍可访问的路径前缀（认证流程 + 个人资料 + 公开只读数据） */
    private static final List<String> WHITELIST_PREFIXES = List.of(
            "/api/auth/", "/api/certification/", "/api/user/", "/api/career/",
            "/uploads/", "/error"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof User user) {
            if (!"ADMIN".equals(user.getRole())
                    && !isWhitelisted(request.getRequestURI())
                    && !certificationService.isIdentityVerified(user.getId())) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(objectMapper.writeValueAsString(
                        Result.error(40301, "请先完成在校生/校友身份认证")));
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private boolean isWhitelisted(String uri) {
        for (String prefix : WHITELIST_PREFIXES) {
            if (uri.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
