package com.NJUChampion.Valorant.config;

import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.builder()
                    .username("admin")
                    .password(passwordEncoder.encode("admin123"))
                    .gameId("管理员#0001")
                    .role("ADMIN")
                    .status(1)
                    .build();
            userRepository.save(admin);
            log.info("========================================");
            log.info("  管理员账号已创建");
            log.info("  用户名: admin");
            log.info("  密码:   admin123");
            log.info("========================================");
        } else {
            log.info("管理员账号已存在，跳过初始化");
        }
    }
}