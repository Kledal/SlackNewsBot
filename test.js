var natural = require('natural'),
  classifier = new natural.BayesClassifier();

classifier.addDocument('Google klar med skelsættende gennembrud i kunstig intelligens', 'like');
classifier.addDocument('Kontanthjælpsloft rammer hårdest i de store byer', 'dislike');
classifier.addDocument('15 år efter 9/11-angreb er USA i evig krig', 'like');
classifier.addDocument('Lærer: Det er som om, at uanset hvad jeg gør, så er det ikke godt nok', 'dislike');
classifier.addDocument('Professor kalder udspil fra regeringen "rettighedsmassakre"', 'dislike');

classifier.train();

console.log(classifier.classify('Google slår Apple i q4 salg'));
