import { motion } from 'framer-motion';
import { Calendar, Trash2, Clock } from 'lucide-react';

const HistoryLog = ({ history }) => {
  return (
    <div className="w-full mt-12 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar size={24} className="text-primary" />
          Detection History
        </h2>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
          Last 50 events
        </span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-500 italic glass-card rounded-xl">
            No history found. Start listening to log events!
          </div>
        ) : (
          history.map((item, index) => (
            <motion.div
              key={item.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-4 glass-card rounded-xl border-l-2 border-slate-700 hover:border-primary transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Clock size={18} className="text-slate-400 group-hover:text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200 capitalize">{item.label}</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm font-mono text-slate-400">
                {(item.confidence * 100).toFixed(0)}%
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryLog;
