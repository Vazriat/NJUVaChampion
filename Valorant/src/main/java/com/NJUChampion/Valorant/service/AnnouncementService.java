package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.Announcement;
import com.NJUChampion.Valorant.repository.AnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnnouncementService {
    private final AnnouncementRepository announcementRepository;

    public List<Announcement> getLatest() { return announcementRepository.findTop5ByStatusOrderByPublishedAtDesc("PUBLISHED"); }
    public List<Announcement> listPublished() { return announcementRepository.findByStatusOrderByPublishedAtDesc("PUBLISHED"); }
    public List<Announcement> listAll() { return announcementRepository.findAll(); }
    public Announcement getById(Long id) { return announcementRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Announcement not found")); }
    public Announcement save(Announcement a) { return announcementRepository.save(a); }
    @Transactional
    public Announcement publish(Long id) {
        Announcement a = getById(id);
        a.setStatus("PUBLISHED");
        a.setPublishedAt(LocalDateTime.now());
        return announcementRepository.save(a);
    }
    public void delete(Long id) { announcementRepository.deleteById(id); }
}
