import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, User, Menu } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { getUserData, clearUser, toggleState } from '../userStore/userData';
import ProfileSettingsDropdown from './ProfileSettingsDropdown/ProfileSettingsDropdown.jsx';

/**
 * GlobalFloatingNavbar Component
 * A premium, glassmorphic floating navbar that hides on scroll down and reappears on scroll up.
 * Contains Theme Toggle and User Profile button.
 */
const GlobalFloatingNavbar = () => {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(new Map());
  const scrollThreshold = 15;
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [tglState, setTglState] = useRecoilState(toggleState);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const user = getUserData() || { name: 'Guest' };
  const token = user?.token;

  // Scroll detection logic
  useEffect(() => {
    const handleScroll = (e) => {
      const target = e.target;
      
      // Ignore document/window scrolls as they can be noisy on mobile
      if (target === document || target === document.documentElement || target === window) {
        return; 
      }
      
      // Identify scrollable containers (consistent with Navigation.Provider.jsx)
      const isChat = target.classList && target.classList.contains('chatgpt-container');
      const isMain = target.tagName === 'MAIN';
      
      if (!isChat && !isMain) return;

      const targetKey = isChat ? 'chat' : 'main';
      const currentScrollY = target.scrollTop ?? 0;
      const prevScrollY = lastScrollY.current.get(targetKey) || 0;

      // Always show at top
      if (currentScrollY <= 10) {
        setVisible(true);
        lastScrollY.current.set(targetKey, currentScrollY);
        return;
      }

      const diff = currentScrollY - prevScrollY;
      if (Math.abs(diff) > scrollThreshold) {
        if (currentScrollY > prevScrollY) {
          // scroll down -> hide
          setVisible(false);
        } else {
          // scroll up -> show
          setVisible(true);
        }
        lastScrollY.current.set(targetKey, currentScrollY);
      }
    };

    // Use capture: true to catch scroll events from child containers
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true, passive: true });
  }, []);

  // Update CSS variable for layout padding (optional but good for consistency)
  useEffect(() => {
    // Keep padding constant to prevent layout shifts/flickering on scroll.
    document.documentElement.style.setProperty('--floating-nav-h', '72px');
    return () => document.documentElement.style.setProperty('--floating-nav-h', '0px');
  }, []);

  return null;

};

export default GlobalFloatingNavbar;
