package com.NJUChampion.Valorant.config;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.config.jwt.JwtAuthFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CertificationGateFilter certificationGateFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/career/**").permitAll()
                .requestMatchers("/uploads/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            // 未认证 -> 401，已认证但权限不足 -> 403。
            // 不配置时 Spring 会落到默认的 Http403ForbiddenEntryPoint：未登录也返回 403 且响应体为空，
            // 前端无法区分「会话失效」与「权限不足」，token 过期后接口静默失败且不跳登录页。
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                        writeJson(objectMapper, response, HttpServletResponse.SC_UNAUTHORIZED,
                                Result.unauthorized("未登录或登录状态已过期")))
                .accessDeniedHandler((request, response, accessDeniedException) ->
                        writeJson(objectMapper, response, HttpServletResponse.SC_FORBIDDEN,
                                Result.error(403, "无权访问该资源")))
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(certificationGateFilter, JwtAuthFilter.class);

        return http.build();
    }

    /** 过滤器链中直接写出 JSON；这里不经过 GlobalExceptionHandler */
    private void writeJson(ObjectMapper objectMapper, HttpServletResponse response,
                           int status, Result<?> body) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
