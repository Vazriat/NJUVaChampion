package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.Banner;
import com.NJUChampion.Valorant.repository.BannerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BannerService {
    private final BannerRepository bannerRepository;

    public List<Banner> getActive() { return bannerRepository.findByActiveTrueOrderBySortOrderAsc(); }
    public List<Banner> listAll() { return bannerRepository.findAll(); }
    public Banner getById(Long id) { return bannerRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Banner not found")); }
    public Banner save(Banner b) { return bannerRepository.save(b); }
    public void delete(Long id) { bannerRepository.deleteById(id); }
}
