package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.*;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.repository.UserRepository;
import com.NJUChampion.Valorant.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public User register(RegisterRequest req) {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new IllegalArgumentException("用户名已存在");
        }

        // 空字符串转为 null，避免唯一索引冲突
        String email = (req.getEmail() != null && !req.getEmail().isBlank()) ? req.getEmail() : null;
        String gameId = (req.getGameId() != null && !req.getGameId().isBlank()) ? req.getGameId() : null;

        if (email != null && userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("邮箱已被使用");
        }

        User user = User.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .gameId(gameId)
                .email(email)
                .build();

        return userRepository.save(user);
    }

    public String login(LoginRequest req) {
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("用户名或密码错误"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("用户名或密码错误");
        }

        if (user.getStatus() == 0) {
            throw new IllegalArgumentException("账号已被禁用");
        }

        return jwtUtil.generateToken(user.getUsername());
    }

    public User getProfile(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("\u7528\u6237\u4e0d\u5b58\u5728在"));
    }

    @Transactional
    public User updateUsername(Long userId, UpdateUsernameRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (userRepository.existsByUsername(req.getNewUsername())) {
            throw new IllegalArgumentException("该用户名已被使用");
        }

        user.setUsername(req.getNewUsername());
        return userRepository.save(user);
    }

    @Transactional
    public User updateEmail(Long userId, UpdateEmailRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (req.getNewEmail() != null && !req.getNewEmail().isBlank()) {
            if (userRepository.existsByEmail(req.getNewEmail())) {
                throw new IllegalArgumentException("该邮箱已被使用");
            }
            user.setEmail(req.getNewEmail());
        }

        return userRepository.save(user);
    }

    @Transactional
    public User updateGameId(Long userId, UpdateGameIdRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        user.setGameId(req.getGameId());
        return userRepository.save(user);
    }

    @Transactional
    public void updatePassword(Long userId, UpdatePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (!passwordEncoder.matches(req.getOldPassword(), user.getPassword())) {
            throw new IllegalArgumentException("旧密码错误");
        }

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public User updateContact(Long userId, com.NJUChampion.Valorant.dto.UpdateContactRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("\u7528\u6237\u4e0d\u5b58\u5728"));
        user.setContact(req.getContact());
        if (req.getContactPublic() != null) {
            user.setContactPublic(req.getContactPublic());
        }
        return userRepository.save(user);
    }

    @Transactional
    public User updateDisplayPreference(Long userId, String preference) {
        User user = userRepository.findById(userId).orElseThrow();
        user.setDisplayPreference(preference);
        return userRepository.save(user);
    }
}