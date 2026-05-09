// Hand-crafted cached roasts — fixtures for Phase 4.5 stage-failure safety net.
// Each one critiques a deliberately-cliché-heavy generic resume. Conformant to
// v1.3.0 BASE_INSTRUCTIONS: meta block first, section-wise body, persona signature.
// Replace with real LLM outputs post-talk if desired; the format contract is what
// the frontend's `parseMeta` / `renderRoast` rely on.

const GENTLE = `<meta>{"specificity":3,"quantification":1,"clarity":6,"cliche_free":2,"pull_quote":"there's a real engineer in here. they're just hidden behind the words 'results-driven' and 'cross-functional'.","meme_caption":"every recruiter when they read 'results-driven':\\n*thousand-yard stare*"}</meta>

## At a glance
There's a real engineer in here. I can feel it. The words just need to step aside and let the work show through.

## The Summary section
"Results-driven software engineer with 2 years of experience and a passion for building scalable systems and delivering value to stakeholders." — sweetheart, this sentence could belong to anyone. What I want to know in two seconds: what did you actually build, who used it, and why was it better after you touched it. What if you said: "Software engineer who shipped Y at TechCorp, used by Z customers." See how much more you sound like *you*?

## The Experience section
"Worked on backend services" tells me you had a job. It doesn't tell me you did one. What kind of services? Payments? Auth? Search? Pick one and own it. "Improved performance of the API" is the one that worries me most — what API, by how much, and how do you know? I love that you wanted to lead with impact. Now bring the receipts. Numbers turn vague claims into trust.

## The Internships section
"Helped build the dashboard. Fixed bugs. Wrote tests." — three years from now, you'll wish past-you had said *which* dashboard, *what kind of bugs*, *what you tested and why it mattered*. Your internship deserves better than this. Be specific. Even one number — "reduced production incidents by half" — changes how the page reads.

## The Skills section
The list is fine but it's wallpaper. Hiring managers skim past it unless something is unusual. If "AWS" is just "I clicked around in the console once," cut it. If you actually shipped something on it, lift that into Experience instead. The story is in what you did, not what you've heard of.

## The fix this week
Pick the one bullet that you're proudest of in your whole career so far. Open the doc. Add three numbers to it — quantity, scale, and outcome. Just that. One bullet, three numbers. The rest of the resume will follow that example.

## Verdict
Yes. With a careful weekend rewrite, this becomes a phone screen. The bones are good — the prose is just wearing a coat that doesn't fit.

*— anjali mehrotra, sr. recruiter, mumbai*`;

const HONEST = `<meta>{"specificity":3,"quantification":1,"clarity":7,"cliche_free":2,"pull_quote":"'worked on backend services' is the resume equivalent of 'i exist.' true, but not why we'd hire you.","meme_caption":"tell me you've never shipped without telling me:\\n'Worked on the API.'"}</meta>

## The 60-second test
Sixty seconds in I had: 2 years, python, aws, "results-driven." That's all most resumes give and that's all I got from yours. I have no idea what you've actually shipped. As a hiring manager I'd skim past this and move on. That's not a personal judgment — it's what the resume is signaling.

## The Summary section
"Results-driven software engineer." Two years in, this phrase signals you read a LinkedIn article about how to write a resume. Which is fine. But everyone read that article, so it's not differentiating. Cut the summary or rewrite it as one specific line: what you can do that most people at your level can't.

## The Experience section
This is the section that's hurting you the most. "Worked on backend services" means nothing. "Improved performance of the API" means nothing. "Collaborated with cross-functional teams" — every job that exists requires this; you don't get points for breathing. I want to read the bullet and learn something about your craft. Right now I learn nothing.

## The Internships section
Same problem, more forgivable. "Fixed bugs" is fine for an intern bullet IF you say which bug and what shipping it changed. "Wrote tests" — for what coverage gain, in what code, that prevented what regression?

## The Skills section
A laundry list of common skills carries almost no signal. If you used Docker to ship a real thing, that's interesting. If you ran \`docker run\` once at school, the line is doing you no favors. Match each tool to a project that proves you used it.

## The rewrite
The weakest bullet on the resume: "Improved performance of the API."

What I would write: *"Cut p99 latency on the orders API from 412ms to 87ms by replacing the N+1 user-lookup with a single join. Saw a measurable drop in support tickets the week after."*

If that wasn't the actual change — write what *was*. The shape is what matters: what was wrong, what you did, what got better, by how much.

## My read
Two years in, this resume reads like one year. Not because the work isn't there — I'd bet it is — but because the writing hasn't caught up to it. I'd pass on this version. With one weekend of rewriting, I'd phone-screen the next version. The work is the same; the resume isn't.

*— vikram reddy, sr. staff engineer*`;

const BRUTAL = `<meta>{"specificity":2,"quantification":1,"clarity":7,"cliche_free":1,"pull_quote":"this resume is what would happen if a LinkedIn 'top voice' wrote a resume to apply to itself.","meme_caption":"this resume's energy: 2014 LinkedIn"}</meta>

## The first impression
This is a resume that has read other resumes. It hasn't done much else. "Results-driven." "Passion." "Cross-functional teams." "Delivering value to stakeholders." Every cliché the genre offers, present and accounted for. Two years of actual engineering work — invisible. I've read this resume two thousand times before, with different names on top.

## The Summary section
"Results-driven software engineer with 2 years of experience and a passion for building scalable systems and delivering value to stakeholders." — what is this, 2014? Who talks like this in real life? Strip every word that any candidate could plausibly write. What's left? "Software engineer with 2 years of experience." That's your real summary. Either say something specific about what you do, or cut the section. Filler is worse than absence.

## The Experience section
"Worked on backend services." Worked. On. Backend. Services. This is the equivalent of writing "Did the job they paid me to do." Of course you did. The bullet's job is to tell me *which* job, *which* service, *who used it*, and *why it mattered when you ran it*. "Improved performance of the API" — by how much? From what to what? Performance of *which* operation? You're not protecting trade secrets with this vagueness — you're hiding skill. Don't.

## The Internships section
"Helped build the dashboard. Fixed bugs. Wrote tests." Helped. Fixed. Wrote. Three verbs that apply to literally anyone who has ever touched a codebase. The least-bad version of this section names one thing you did that a senior engineer would have to have done if you weren't there. Right now: any of this could have happened or not happened, and I would not know.

## The Skills section
A list of tools without context is the resume equivalent of describing your kitchen by listing the appliances. So you have a stove. Tell me what you've cooked.

## The bullet that broke me
"Collaborated with cross-functional teams."

What I'd want: *"Worked with two PMs and a designer to ship the new checkout flow; convinced the team to defer the GraphQL migration after writing a 1-pager showing it would block the launch."*

If you didn't do that — write what you actually did. But say *something*. A bullet that any human in any office could write is a bullet doing nothing for you.

## What I'd tell my friend who looks like this on paper
Look — you're not bad at the job. The job and the resume are two different skills, and you've only been practicing one. A weekend with a friend who'll ask "what did you actually do?" after every bullet will fix this resume. Numbers, names, specifics, scale. That's the whole game.

## Verdict
Pass on this version. Phone screen on the rewrite.

*— marcus chen, hiring manager, seattle*`;

export const DEMO_ROASTS = { gentle: GENTLE, honest: HONEST, brutal: BRUTAL };
