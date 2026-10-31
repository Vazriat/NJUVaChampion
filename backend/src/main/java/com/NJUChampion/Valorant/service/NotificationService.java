package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.UserNotificationVO;
import com.NJUChampion.Valorant.entity.UserNotification;
import com.NJUChampion.Valorant.repository.UserNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 定向通知服务。
 *
 * 说明：通知写入与业务操作共用同一个事务，业务回滚时通知一并回滚，不会产生"幽灵通知"。
 * 通知失败不应阻断主流程，因此调用方一律用 notifyOther/notifyUser 且不捕获异常——
 * 这里的实现不依赖外部系统，不会失败。
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_LIST_SIZE = 50;
    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_CONTENT_LENGTH = 500;

    private final UserNotificationRepository repository;

    @Transactional
    public void notifyUser(Long userId, String type, String title, String content,
                           String refType, Long refId) {
        if (userId == null || type == null || title == null) {
            return;
        }
        repository.save(UserNotification.builder()
                .userId(userId)
                .type(type)
                .title(truncate(title, MAX_TITLE_LENGTH))
                .content(truncate(content, MAX_CONTENT_LENGTH))
                .refType(refType)
                .refId(refId)
                .readFlag(false)
                .build());
    }

    /** 通知"对方"。若对方就是操作者本人（例如自问自答的场景）则跳过，避免自己收到自己的通知。 */
    @Transactional
    public void notifyOther(Long actorUserId, Long targetUserId, String type, String title,
                            String content, String refType, Long refId) {
        if (targetUserId == null || targetUserId.equals(actorUserId)) {
            return;
        }
        notifyUser(targetUserId, type, title, content, refType, refId);
    }

    public List<UserNotificationVO> list(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .limit(MAX_LIST_SIZE)
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    public long unreadCount(Long userId) {
        return repository.countByUserIdAndReadFlagFalse(userId);
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        UserNotification notification = repository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("通知不存在"));
        if (!notification.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权操作该通知");
        }
        if (Boolean.TRUE.equals(notification.getReadFlag())) {
            return;
        }
        notification.setReadFlag(true);
        repository.save(notification);
    }

    @Transactional
    public int markAllRead(Long userId) {
        return repository.markAllReadByUserId(userId);
    }

    private UserNotificationVO toVO(UserNotification notification) {
        return UserNotificationVO.builder()
                .id(notification.getId())
                .type(notification.getType())
                .title(notification.getTitle())
                .content(notification.getContent())
                .refType(notification.getRefType())
                .refId(notification.getRefId())
                .readFlag(notification.getReadFlag())
                .createdAt(notification.getCreatedAt())
                .build();
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
