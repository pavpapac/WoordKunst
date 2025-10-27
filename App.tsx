import React, { useState } from 'react';
import { generateCreativeContent, CreativeContent } from './services/geminiService';
import Loader from './components/Loader';

interface QuizQuestion {
    word: string; // The word to be translated
    options: string[];
    correctAnswer: string;
    userAnswer: string | null;
}

const App: React.FC = () => {
    const [inputWords, setInputWords] = useState<string>('');
    const [direction, setDirection] = useState<'en-to-nl' | 'nl-to-en'>('en-to-nl');
    const [isBeginner, setIsBeginner] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CreativeContent | null>(null);
    
    // Quiz State
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
    const [quizScore, setQuizScore] = useState<number>(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputWords.trim()) {
            setError("Please enter some words to translate.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        setQuizQuestions([]);

        try {
            const inputLanguage = direction === 'en-to-nl' ? 'English' : 'Dutch';
            const translationLanguage = direction === 'en-to-nl' ? 'Dutch' : 'English';
            const content = await generateCreativeContent(inputWords, inputLanguage, translationLanguage, isBeginner);
            setResult(content);
            generateQuiz(content.translations);
            setQuizSubmitted(false);
            setQuizScore(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const generateQuiz = (translations: { original: string; translated: string; }[]) => {
        if (translations.length < 2) { // Quiz is not very useful with 1 word
            setQuizQuestions([]);
            return;
        }

        const allTranslatedWords = translations.map(t => t.translated);

        const shuffleArray = (array: string[]) => {
            const newArr = [...array];
            for (let i = newArr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
            return newArr;
        };

        const newQuizQuestions: QuizQuestion[] = translations.map(pair => {
            const correctAnswer = pair.translated;
            const distractors = allTranslatedWords.filter(word => word !== correctAnswer);
            const shuffledDistractors = shuffleArray(distractors);
            
            const numOptions = Math.min(4, allTranslatedWords.length);
            const options = [correctAnswer, ...shuffledDistractors.slice(0, numOptions - 1)];

            return {
                word: pair.original,
                options: shuffleArray(options),
                correctAnswer: correctAnswer,
                userAnswer: null,
            };
        });

        setQuizQuestions(newQuizQuestions);
    };

    const handleAnswerSelect = (questionIndex: number, selectedOption: string) => {
        if (quizSubmitted) return;
        
        const newQuestions = [...quizQuestions];
        newQuestions[questionIndex].userAnswer = selectedOption;
        setQuizQuestions(newQuestions);
    };

    const handleCheckQuiz = () => {
        let score = 0;
        quizQuestions.forEach(q => {
            if (q.userAnswer === q.correctAnswer) {
                score++;
            }
        });
        setQuizScore(score);
        setQuizSubmitted(true);
    };

    const handleTryAgain = () => {
        setQuizSubmitted(false);
        setQuizScore(0);
        const resetQuestions = quizQuestions.map(q => ({ ...q, userAnswer: null }));
        setQuizQuestions(resetQuestions);
    };


    const inputLangLabel = direction === 'en-to-nl' ? 'English' : 'Dutch';
    const translatedLangLabel = direction === 'en-to-nl' ? 'Dutch' : 'English';

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                        WoordKunst
                    </h1>
                    <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">Turn your words into art. Learn Dutch with unique stories, comics, and audio.</p>
                </header>

                <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Learning Path</label>
                            <div className="flex space-x-4 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                                <button type="button" onClick={() => setDirection('en-to-nl')} className={`w-full text-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${direction === 'en-to-nl' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                    English to Dutch
                                </button>
                                <button type="button" onClick={() => setDirection('nl-to-en')} className={`w-full text-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${direction === 'nl-to-en' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                                    Dutch to English
                                </button>
                            </div>
                        </div>

                         <div className="mb-6">
                            <label htmlFor="words-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Words to learn (in {inputLangLabel})</label>
                            <textarea
                                id="words-input"
                                value={inputWords}
                                onChange={(e) => setInputWords(e.target.value)}
                                placeholder={direction === 'en-to-nl' ? 'e.g., cat, house, moon, adventure' : 'e.g., kat, huis, maan, avontuur'}
                                rows={4}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isBeginner}
                                    onChange={(e) => setIsBeginner(e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Beginner Mode</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Simpler story, slower podcast.</span>
                                </div>
                            </label>
                        </div>


                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
                        >
                            {isLoading ? 'Creating...' : 'Create Word Art'}
                        </button>
                    </form>
                </div>

                {isLoading && <Loader />}

                {error && (
                    <div className="max-w-2xl mx-auto mt-8 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                
                {result && !isLoading && (
                    <div className="max-w-4xl mx-auto mt-8 space-y-8">
                        {/* Image */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Story Comic</h2>
                             {result.imageUrl && <img src={result.imageUrl} alt="Generated comic based on the story" className="w-full h-auto rounded-lg object-cover" />}
                        </div>

                        {/* Translation */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Your Word Translations</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {result.translations.map((pair, index) => (
                                    <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm transition-transform hover:scale-105 hover:shadow-md">
                                        <div className="flex items-center justify-between">
                                            <div className="text-left">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{inputLangLabel}</p>
                                                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{pair.original}</p>
                                            </div>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mx-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                            <div className="text-right">
                                                <p className="text-xs text-blue-500 dark:text-blue-400 uppercase tracking-wider">{translatedLangLabel}</p>
                                                <p className="text-xl font-bold text-blue-600 dark:text-blue-300">{pair.translated}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Story & Podcast */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Your Dutch Story & Podcast</h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">{result.story}</p>
                            <audio controls src={result.audioUrl} className="w-full">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                        
                        {/* Vocabulary Quiz */}
                        {quizQuestions.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                                <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Test Your Knowledge!</h2>
                                
                                <div className="space-y-6">
                                    {quizQuestions.map((q, index) => (
                                        <div key={index} className="border-t border-gray-200 dark:border-gray-700 pt-4 first:border-t-0">
                                            <p className="font-semibold text-lg mb-3">
                                                {index + 1}. What is the {translatedLangLabel} translation for <span className="font-bold text-blue-500 dark:text-blue-400">"{q.word}"</span>?
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {q.options.map((option, optionIndex) => {
                                                    const isSelected = q.userAnswer === option;
                                                    const isCorrect = option === q.correctAnswer;
                                                    let buttonClass = 'p-3 w-full text-left rounded-lg border transition-colors duration-200 ';
                                                    
                                                    if (quizSubmitted) {
                                                        if (isCorrect) {
                                                            buttonClass += 'bg-green-100 dark:bg-green-800/50 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200 font-semibold';
                                                        } else if (isSelected && !isCorrect) {
                                                            buttonClass += 'bg-red-100 dark:bg-red-800/50 border-red-400 dark:border-red-600 text-red-800 dark:text-red-200 line-through';
                                                        } else {
                                                            buttonClass += 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-70';
                                                        }
                                                    } else {
                                                        buttonClass += 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 ';
                                                        if (isSelected) {
                                                            buttonClass += 'ring-2 ring-blue-500 border-transparent';
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={optionIndex}
                                                            onClick={() => handleAnswerSelect(index, option)}
                                                            disabled={quizSubmitted}
                                                            className={buttonClass}
                                                        >
                                                            {option}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {quizSubmitted && (
                                    <div className="mt-6 text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700">
                                        <p className="text-xl font-bold text-blue-800 dark:text-blue-200">You scored {quizScore} out of {quizQuestions.length}!</p>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-center">
                                    {quizSubmitted ? (
                                        <button 
                                            onClick={handleTryAgain}
                                            className="text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-800"
                                        >
                                            Try Again
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleCheckQuiz}
                                            disabled={quizQuestions.some(q => q.userAnswer === null)}
                                            className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
                                        >
                                            Check Answers
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
