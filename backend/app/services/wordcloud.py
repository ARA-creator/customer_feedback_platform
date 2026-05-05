import io
import logging
import re
from typing import List, Optional

from wordcloud import WordCloud

logger = logging.getLogger(__name__)

# Common stopwords to exclude (basic list, can be expanded)
STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
    "can", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "me", "him", "her", "us", "them", "my", "your", "his", "her", "its", "our", "their",
    "what", "which", "who", "whom", "whose", "where", "when", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just", "now", "then", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "can", "will", "just", "don", "should", "now",
}


def clean_text(text: str) -> str:
    """Remove URLs, emails, and clean up text for word cloud."""
    if not text:
        return ""
    
    # Remove URLs
    text = re.sub(r'http\S+|www\.\S+', '', text)
    # Remove email addresses
    text = re.sub(r'\S+@\S+', '', text)
    # Remove special characters but keep spaces and basic punctuation
    text = re.sub(r'[^\w\s]', ' ', text)
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    return text.lower()


def generate_wordcloud(texts: List[str], width: int = 800, height: int = 400) -> Optional[bytes]:
    """
    Generate word cloud image from list of text strings.
    
    Args:
        texts: List of text strings (feedback messages)
        width: Image width in pixels
        height: Image height in pixels
    
    Returns:
        PNG image as bytes, or None if no valid text
    """
    if not texts:
        return None
    
    # Combine all texts
    combined_text = " ".join(texts)
    
    # Clean the text
    cleaned = clean_text(combined_text)
    
    if not cleaned or len(cleaned.strip()) < 10:
        return None
    
    try:
        # Generate word cloud with colorful palette
        wordcloud = WordCloud(
            width=width,
            height=height,
            background_color='white',
            max_words=1000,
            relative_scaling=0.5,
            colormap='viridis',  # Colorful palette (green, yellow, purple)
            stopwords=STOPWORDS,
            collocations=False,  # Don't combine phrases
            min_word_length=3,
        ).generate(cleaned)
        
        # Convert to PNG bytes
        img_buffer = io.BytesIO()
        wordcloud.to_image().save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return img_buffer.getvalue()
    
    except Exception as e:
        logger.exception(f"Error generating word cloud: {e}")
        return None
