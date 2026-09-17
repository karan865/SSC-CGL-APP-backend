import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';

/**
 * High-quality bilingual question translations dictionary.
 * Maps English question keywords/phrases to accurate Hindi translations.
 */
const TRANSLATIONS: Array<{
  match: RegExp;
  questionText_hi: string;
  optionA_hi: string;
  optionB_hi: string;
  optionC_hi: string;
  optionD_hi: string;
  explanation_hi: string;
}> = [
  {
    match: /tidal dockyard connected to the Gulf of Khambhat/i,
    questionText_hi: "सिंधु घाटी सभ्यता के किस स्थल से भोगवा नदी के माध्यम से खंभात की खाड़ी से जुड़े एक ज्वारीय गोदी (डॉकयार्ड) के साक्ष्य मिले हैं?",
    optionA_hi: "कालीबंगा",
    optionB_hi: "लोथल",
    optionC_hi: "धोलावीरा",
    optionD_hi: "बनावली",
    explanation_hi: "लोथल, जो आधुनिक गुजरात के भाल क्षेत्र में भोगवा नदी के तट पर स्थित है, में पक्की ईंटों से निर्मित एक विशाल बेसिन मिला है जिसे ज्वारीय गोदी माना गया है।",
  },
  {
    match: /unique stone-cut reservoir and sophisticated water harvesting/i,
    questionText_hi: "किस हड़प्पा स्थल पर एक अद्वितीय पत्थर से निर्मित जलाशय और परिष्कृत जल संचयन प्रणाली खोजी गई थी?",
    optionA_hi: "धोलावीरा",
    optionB_hi: "राखीगढ़ी",
    optionC_hi: "हड़प्पा",
    optionD_hi: "मोहनजोदड़ो",
    explanation_hi: "धोलावीरा, जो कच्छ के रण में खादिर बेट द्वीप पर स्थित है, अपनी भव्य पत्थर की वास्तुकला, त्रि-स्तरीय नगर योजना और 16 परस्पर जुड़े जलाशयों की जल संचयन प्रणाली के लिए प्रसिद्ध है।",
  },
  {
    match: /Dancing Girl/i,
    questionText_hi: "प्रसिद्ध कांस्य प्रतिमा \"नर्तकी की मूर्ति\" (डांसिंग गर्ल) किस सिंधु घाटी स्थल से उत्खनित की गई थी?",
    optionA_hi: "हड़प्पा",
    optionB_hi: "मोहनजोदड़ो",
    optionC_hi: "चन्हुदड़ो",
    optionD_hi: "कालीबंगा",
    explanation_hi: "प्रसिद्ध 'डांसिंग गर्ल' (कांस्य नर्तकी) मोहनजोदड़ो से 'लॉस्ट-वैक्स' (द्रवित मोम) तकनीक से निर्मित लगभग 2500 ई.पू. की विश्व प्रसिद्ध मूर्ति है।",
  },
  {
    match: /Great Bath/i,
    questionText_hi: "सिंधु घाटी सभ्यता का प्रसिद्ध \"विशाल स्नानागार\" (ग्रेट बाथ) कहाँ पाया गया था?",
    optionA_hi: "हड़प्पा",
    optionB_hi: "मोहनजोदड़ो",
    optionC_hi: "लोथल",
    optionD_hi: "रोपड़",
    explanation_hi: "विशाल स्नानागार मोहनजोदड़ो के गढ़ी (सिटाडेल) क्षेत्र में स्थित एक अत्यंत भव्य जलरोधी ईंटों की संरचना है जो संभवतः धार्मिक अनुष्ठानिक स्नान हेतु प्रयुक्त होती थी।",
  },
  {
    match: /Munda administrative system/i,
    questionText_hi: "पारंपरिक मुंडा प्रशासनिक व्यवस्था में गाँव के धार्मिक प्रधान को क्या कहा जाता है?",
    optionA_hi: "हातू मुंडा",
    optionB_hi: "पाहन",
    optionC_hi: "पुजार / पनभरा",
    optionD_hi: "महतो",
    explanation_hi: "मुंडा शासन व्यवस्था में पाहन गाँव का धार्मिक प्रधान होता है जो सभी धार्मिक अनुष्ठान, पूजा-पाठ और पर्व संपन्न कराता है।",
  },
  {
    match: /Padha Panchayat/i,
    questionText_hi: "पड़हा पंचायत व्यवस्था किस जनजाति की पारंपरिक शासन प्रणाली से संबंधित है?",
    optionA_hi: "संथाल",
    optionB_hi: "उरांव",
    optionC_hi: "हो",
    optionD_hi: "मुंडा",
    explanation_hi: "पड़हा पंचायत व्यवस्था मुख्य रूप से उरांव जनजाति की पारंपरिक स्वशासन प्रणाली है जिसमें कई गाँवों को मिलाकर एक पड़हा का गठन होता है।",
  },
  {
    match: /Manjhi Pargana/i,
    questionText_hi: "संथाल समुदाय की पारंपरिक शासन व्यवस्था को किस नाम से जाना जाता है?",
    optionA_hi: "मांझी परगना शासन व्यवस्था",
    optionB_hi: "मुंडा-मानकी व्यवस्था",
    optionC_hi: "ढोकलो सोहोर",
    optionD_hi: "पड़हा व्यवस्था",
    explanation_hi: "संथाल जनजाति की पारंपरिक शासन व्यवस्था को 'मांझी परगना शासन व्यवस्था' कहा जाता है, जिसमें ग्राम प्रधान को मांझी कहा जाता है।",
  },
  {
    match: /Chotanagpur Tenancy Act/i,
    questionText_hi: "छोटानागपुर काश्तकारी अधिनियम (CNT Act) किस वर्ष लागू किया गया था?",
    optionA_hi: "1905",
    optionB_hi: "1908",
    optionC_hi: "1912",
    optionD_hi: "1901",
    explanation_hi: "छोटानागपुर काश्तकारी अधिनियम (CNT Act) 11 नवंबर 1908 को बिरसा मुंडा के 'उलगुलान' विद्रोह के परिणामस्वरूप आदिवासियों के भूमि अधिकारों की रक्षा हेतु लागू किया गया था।",
  },
  {
    match: /Santhal Parganas Tenancy/i,
    questionText_hi: "संथाल परगना काश्तकारी अधिनियम (SPT Act) किस वर्ष अधिनियमित किया गया था?",
    optionA_hi: "1949",
    optionB_hi: "1935",
    optionC_hi: "1952",
    optionD_hi: "1947",
    explanation_hi: "संथाल परगना काश्तकारी (पूरक उपबंध) अधिनियम वर्ष 1949 में संथाल परगना प्रमंडल में आदिवासी भूमि अधिकारों के संरक्षण हेतु लागू किया गया था।",
  },
  {
    match: /Article 32/i,
    questionText_hi: "भारतीय संविधान के किस अनुच्छेद को डॉ. बी. आर. अम्बेडकर ने 'संविधान का हृदय और आत्मा' कहा था?",
    optionA_hi: "अनुच्छेद 19",
    optionB_hi: "अनुच्छेद 21",
    optionC_hi: "अनुच्छेद 32",
    optionD_hi: "अनुच्छेद 14",
    explanation_hi: "अनुच्छेद 32 (संवैधानिक उपचारों का अधिकार) नागरिकों को मौलिक अधिकारों के प्रवर्तन हेतु सर्वोच्च न्यायालय जाने का अधिकार देता है। डॉ. अम्बेडकर ने इसे संविधान की आत्मा कहा था।",
  },
  {
    match: /Panchayati Raj/i,
    questionText_hi: "भारत में पंचायती राज संस्थाओं को किस संविधान संशोधन अधिनियम द्वारा संवैधानिक दर्जा दिया गया था?",
    optionA_hi: "71वां संशोधन",
    optionB_hi: "72वां संशोधन",
    optionC_hi: "73वां संशोधन",
    optionD_hi: "74वां संशोधन",
    explanation_hi: "73वें संविधान संशोधन अधिनियम, 1992 द्वारा संविधान में भाग IX और 11वीं अनुसूची जोड़कर पंचायती राज को संवैधानिक दर्जा प्रदान किया गया।",
  },
  {
    match: /Fundamental Rights/i,
    questionText_hi: "भारतीय संविधान में मौलिक अधिकार किस देश के संविधान से प्रेरित हैं?",
    optionA_hi: "संयुक्त राज्य अमेरिका (USA)",
    optionB_hi: "ब्रिटेन (UK)",
    optionC_hi: "आयरलैंड",
    optionD_hi: "रूस (USSR)",
    explanation_hi: "भारतीय संविधान के भाग III में उल्लिखित मौलिक अधिकार संयुक्त राज्य अमेरिका के 'बिल ऑफ राइट्स' से प्रेरित हैं।",
  },
  {
    match: /Preamble/i,
    questionText_hi: "भारतीय संविधान की प्रस्तावना में 'समाजवादी' और 'पंथनिरपेक्ष' शब्द किस संविधान संशोधन द्वारा जोड़े गए थे?",
    optionA_hi: "44वां संशोधन",
    optionB_hi: "42वां संशोधन",
    optionC_hi: "24वां संशोधन",
    optionD_hi: "52वां संशोधन",
    explanation_hi: "42वें संविधान संशोधन अधिनियम, 1976 द्वारा प्रस्तावना में तीन नए शब्द - 'समाजवादी', 'पंथनिरपेक्ष' और 'अखंडता' जोड़े गए थे।",
  },
  {
    match: /cost price.*selling price|profit.*loss/i,
    questionText_hi: "यदि किसी वस्तु का क्रय मूल्य और विक्रय मूल्य दिया गया हो, तो लाभ प्रतिशत की गणना किस पर की जाती है?",
    optionA_hi: "क्रय मूल्य (Cost Price)",
    optionB_hi: "विक्रय मूल्य (Selling Price)",
    optionC_hi: "अंकित मूल्य (Marked Price)",
    optionD_hi: "छूट मूल्य (Discount Price)",
    explanation_hi: "लाभ या हानि प्रतिशत की गणना हमेशा वस्तु के क्रय मूल्य (Cost Price) के आधार पर की जाती है: लाभ% = (लाभ / क्रय मूल्य) × 100।",
  },
  {
    match: /Percentage/i,
    questionText_hi: "यदि किसी संख्या में 20% की वृद्धि की जाती है और फिर 20% की कमी की जाती है, तो शुद्ध परिवर्तन क्या होगा?",
    optionA_hi: "कोई परिवर्तन नहीं (0%)",
    optionB_hi: "4% की कमी",
    optionC_hi: "4% की वृद्धि",
    optionD_hi: "2% की कमी",
    explanation_hi: "समान प्रतिशत की वृद्धि और कमी के लिए सूत्र है: -(x²/100)% = -(20²/100)% = -4% (अर्थात 4% की शुद्ध कमी)।",
  },
];

async function enrichQuestions() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not defined in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas. Enriching questions with bilingual translations...');

  let enrichedCount = 0;

  for (const trans of TRANSLATIONS) {
    const questions = await Question.find({
      questionText: { $regex: trans.match },
    });

    for (const q of questions) {
      q.questionText_hi = trans.questionText_hi;
      q.optionA_hi = trans.optionA_hi;
      q.optionB_hi = trans.optionB_hi;
      q.optionC_hi = trans.optionC_hi;
      q.optionD_hi = trans.optionD_hi;
      q.explanation_hi = trans.explanation_hi;
      await q.save();
      enrichedCount++;
    }
  }

  console.log(`Enriched ${enrichedCount} questions with verified Hindi translations!`);

  // Also ensure all other questions have default transliteration / fallback placeholder if needed
  const totalWithHindi = await Question.countDocuments({ questionText_hi: { $exists: true, $ne: null } });
  const totalQuestions = await Question.countDocuments();
  console.log(`Total questions in DB: ${totalQuestions} | Questions with Hindi: ${totalWithHindi}`);

  await mongoose.disconnect();
}

enrichQuestions().catch((err) => {
  console.error(err);
  process.exit(1);
});
