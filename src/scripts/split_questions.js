const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Questions-Sets', 'jpsc_jharkhand_specific_awareness_1000_mcqs_bilingual_correct_hindi.md');
const dir = path.dirname(filePath);
const baseName = path.basename(filePath, '.md');

// Delete the old long-named files
for (let i = 1; i <= 10; i++) {
    const oldFilePath = path.join(dir, `${baseName}_part${i}.md`);
    if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
    }
}

const content = fs.readFileSync(filePath, 'utf-8');

// Split before each question
const parts = content.split(/\n(?=## Q\d+\.)/);

console.log(`Total parts found: ${parts.length}`);

// parts[0] is the header (lines 1 to 24)
// parts[1] to parts[1000] are the questions

const header = parts[0];
const questions = parts.slice(1);

console.log(`Total questions: ${questions.length}`);

if (questions.length !== 1000) {
    console.error("Expected 1000 questions, found " + questions.length);
}

for (let i = 0; i < 10; i++) {
    const chunk = questions.slice(i * 100, (i + 1) * 100);
    
    let fileContent = '';
    if (i === 0) {
        fileContent = header + '\n' + chunk.join('\n');
    } else {
        fileContent = chunk.join('\n');
    }
    
    // Naming them simply by number
    const newFileName = `${i + 1}.md`;
    const newFilePath = path.join(dir, newFileName);
    fs.writeFileSync(newFilePath, fileContent, 'utf-8');
    console.log(`Written ${newFilePath} with ${chunk.length} questions.`);
}
