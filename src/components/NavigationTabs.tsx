/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Radio, MessageSquare, Hash, Share2, Settings, Shield } from 'lucide-react';

export type MainTab = 'nearby' | 'chats' | 'channels' | 'network' | 'settings';

interface NavigationTabsProps {
  activeTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
  peerCount: number;
  unreadChatCount: number;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onChangeTab,
  peerCount,
  unreadChatCount,
}) => {
  const tabs = [
    {
      id: 'nearby' as MainTab,
      label: 'Nearby',
      icon: Radio,
      badge: peerCount > 0 ? `${peerCount}` : undefined,
    },
    {
      id: 'chats' as MainTab,
      label: 'Chats',
      icon: MessageSquare,
      badge: unreadChatCount > 0 ? `${unreadChatCount}` : undefined,
    },
    {
      id: 'channels' as MainTab,
      label: 'Channels',
      icon: Hash,
    },
    {
      id: 'network' as MainTab,
      label: 'Network',
      icon: Share2,
    },
    {
      id: 'settings' as MainTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <nav className="border-t sm:border-t-0 sm:border-r border-slate-800 bg-slate-900/95 sm:bg-slate-900/50 flex sm:flex-col justify-around sm:justify-start sm:w-20 md:w-56 p-2 gap-1 shrink-0 z-20">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`flex flex-col sm:flex-row items-center sm:gap-3 p-2.5 sm:px-4 sm:py-3 rounded-2xl transition-all relative ${
              isActive
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium sm:font-semibold mt-1 sm:mt-0 hidden sm:inline">
              {tab.label}
            </span>

            {tab.badge && (
              <span className="sm:ml-auto px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-mono text-[9px] font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
