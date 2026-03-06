'use client';

import { useState, useEffect } from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  category: string;
}

const categories = [
  { value: 'recommend', label: '推荐' },
  { value: 'all', label: '全部' },
  { value: 'emotion', label: '情感' },
  { value: 'work', label: '工作' },
  { value: 'life', label: '生活' },
  { value: 'hobby', label: '兴趣' },
];

interface TopicSuggestionsProps {
  onSelectTopic: (topic: string) => void;
  characterId?: string;
  mood?: string;
}

export default function TopicSuggestions({ onSelectTopic, characterId = 'gentle', mood = '' }: TopicSuggestionsProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('recommend');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTopics();
  }, [selectedCategory, characterId, mood]);

  const fetchTopics = async () => {
    setLoading(true);
    setError('');
    try {
      let url = '';
      if (selectedCategory === 'recommend') {
        url = `/api/topics/recommend?character=${characterId}&mood=${mood}&limit=6`;
      } else {
        url = `/api/topics?category=${selectedCategory}&limit=6`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '加载话题失败');
        return;
      }

      if (data.success) {
        setTopics(data.data?.topics || []);
      } else {
        setError('话题加载失败，请刷新重试');
      }
    } catch (error) {
      console.error('Fetch topics error:', error);
      setError('网络错误，话题加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center space-x-2 mb-3">
        <Sparkles size={18} className="text-yellow-500" />
        <h3 className="font-medium text-gray-800">不知道聊什么？</h3>
      </div>

      {/* 分类标签 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-3 py-1 text-xs rounded-full transition ${
              selectedCategory === cat.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 话题列表 */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-2">加载中...</p>
      ) : error ? (
        <p className="text-center text-red-400 text-sm py-2">{error}</p>
      ) : topics.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-2">暂无话题</p>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic.title)}
              className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition group"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-800 group-hover:text-blue-600 text-sm">
                  {topic.title}
                </p>
                <MessageCircle size={16} className="text-gray-300 group-hover:text-blue-400 ml-2 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
