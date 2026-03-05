'use client';

import { useState, useEffect } from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';

interface Topic {
  _id: string;
  title: string;
  description: string;
  category: string;
}

const categories = [
  { value: 'all', label: '全部' },
  { value: 'emotion', label: '情感' },
  { value: 'work', label: '工作' },
  { value: 'life', label: '生活' },
  { value: 'interest', label: '兴趣' },
];

interface TopicSuggestionsProps {
  onSelectTopic: (topic: string) => void;
}

export default function TopicSuggestions({ onSelectTopic }: TopicSuggestionsProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTopics();
  }, [selectedCategory]);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/topics?category=${selectedCategory}&limit=6`);
      const data = await res.json();
      if (data.success) {
        setTopics(data.data.topics);
      }
    } catch (error) {
      console.error('Fetch topics error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find((c) => c.value === category);
    return cat?.label || category;
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
      ) : topics.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-2">暂无话题</p>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <button
              key={topic._id}
              onClick={() => onSelectTopic(topic.title)}
              className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-800 group-hover:text-blue-600 text-sm">
                    {topic.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{topic.description}</p>
                </div>
                <MessageCircle size={16} className="text-gray-300 group-hover:text-blue-400 ml-2" />
              </div>
              <span className="inline-block mt-2 text-xs text-gray-400 bg-white px-2 py-0.5 rounded">
                {getCategoryLabel(topic.category)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
