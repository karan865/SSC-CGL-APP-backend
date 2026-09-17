import re
import time
from deep_translator import GoogleTranslator

def is_gibberish(text):
    # Regex to find a consonant followed by an independent vowel
    # Consonants: \u0915-\u0939
    # Independent vowels: \u0904-\u0914
    # Also catch cases like 'ओओ' (independent vowel followed by independent vowel)
    if re.search(r'[\u0915-\u0939][\u0904-\u0914]', text):
        return True
    if re.search(r'[\u0904-\u0914]{2,}', text):
        return True
    return False

def main():
    file_path = r'd:\1. programmins\1.SSC-CGL-APP\Questions-Sets\jpsc_jharkhand_specific_awareness_1000_mcqs_bilingual_correct_hindi.md'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    options_to_translate = []
    line_indices = []
    
    # 1. Identify gibberish options
    for i, line in enumerate(lines):
        match = re.match(r'^(\*\*[A-D]\.\*\*\s+)(.*?)\s+\/\s+(.*?)$', line.strip())
        if match:
            eng_text = match.group(2)
            hi_text = match.group(3)
            if is_gibberish(hi_text):
                options_to_translate.append(eng_text)
                line_indices.append(i)
                
    print(f"Found {len(options_to_translate)} options to translate.")
    
    # 2. Batch translate
    translated_texts = []
    translator = GoogleTranslator(source='en', target='hi')
    
    batch_size = 50
    for i in range(0, len(options_to_translate), batch_size):
        batch = options_to_translate[i:i+batch_size]
        try:
            res = translator.translate_batch(batch)
            translated_texts.extend(res)
            print(f"Translated {i + len(batch)} / {len(options_to_translate)}")
            time.sleep(1) # Be nice to the API
        except Exception as e:
            print(f"Error at batch {i}: {e}")
            # fallback one by one if batch fails
            for text in batch:
                try:
                    res = translator.translate(text)
                    translated_texts.append(res)
                except Exception as e2:
                    print(f"Error translating {text}: {e2}")
                    translated_texts.append(text) # fallback to english
    
    # 3. Replace in lines
    for idx, (line_idx, translated) in enumerate(zip(line_indices, translated_texts)):
        line = lines[line_idx]
        match = re.match(r'^(\*\*[A-D]\.\*\*\s+)(.*?)\s+\/\s+(.*?)$', line.strip())
        if match:
            prefix = match.group(1)
            eng_text = match.group(2)
            new_line = f"{prefix}{eng_text} / {translated}\n"
            lines[line_idx] = new_line
            
    # 4. Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
        
    print("Done! File updated.")

if __name__ == '__main__':
    main()
