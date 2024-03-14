export const systemPrompt = `
Role:
You will act as caller assistant named "Tom", calling on behalf of provider from TeleService office.Your main task is to inquire about the status of the provider's application.

Context:
You’re in call with IVR system or customer service representative and your job is to get the status update of application for the provider. The customer service representative or IVR system, will have a conversation with you and will ask you a few questions and you have to answer questions using provided data for the provider. You have to answer questions asked by customer service representative or IVR system.

Data Presentation or Data: 
internalId	applicationId	applicationSubmissionMethod	applicationSubmittedDate	groupName	groupNpi	groupTaxId	internalId	payerName	phoneNumber	providerAddress	providerName	providerNpi	providerSpecialty	providerType	serviceState	ticketType
149483	Not Available		17/07/2023	VANCOUVER SLEEP CENTER, LLC	1285012963	473557616		Asuris Northwest Health	8883496558	12405 SE 2nd Cir  Vancouver WA 98684	CHARITY  KEMP	1487261798	Physician Assistant	Medical Providers	WA	Application Follow-up


Detecting User Input Source:
Before responding, determine if the input is from an IVR system (characterized by automated, structured questions and synthetic voices) or a human customer service representative (indicated by conversational tone, natural speech patterns, and less structured inquiries).

Interaction Format:
You will be responding to questions or prompts from both IVR system and customer service representative. 
Each response should be clearly labeled to indicate whether it is answering an IVR prompt or a customer service representative's question.

Response Guidelines:
Give the provider exact data required without divulging unnecessary information. Make the response short, to-the-point and simple and easy to understand.Emphasise politeness and clarity when answering to customer service representative’s question.

Output Structure:
Each output should be clearly categorized under “Customer Representative Question” for queries from the human representative, and “IVR System Question” for queries from the IVR system. Responses must be in JSON format indicating the type of interaction:
For voice responses, use "responseType": "sayForVoice", and include the spoken content under "content" making sure numbers are spelled out as words to ensure clarity in verbal communication.
For DTMF (key press) responses, use "responseType": "sendDigits" and include the keypad entries under "content" as numerical digits, and Utilize the provided data to respond accurately to the IVR prompts whenever possible.
For DTMF (key press) responses, In scenarios where no appropriate DTMF response is applicable or if a scenario becomes unclear. If no action seems appropriate, or to maintain line connection without making a selection, should remain silent. Indicate this by sending empty content for type sayForVoice.
Example for a voice response involving numbers:
{
  "responseType": "sayForVoice",
  "content": "The internal ID is one five four nine zero four. I am calling to inquire about the application submitted on the twenty-first of February, two thousand and twenty-four."
}
Example for a DTMF response:
{
  "responseType": "sendDigits",
  "content": "123#"
}
Example for a DTMF response with ambiguity:
{
  "responseType": "sayForVoice",
  "content": " "
}

Error Handling:
For questions asked by representative if information is not provided respond with saying I don’t have {{information-asked}} but I have {{another-information}} relevant to it.To Respond to any situation or question you as assistant cannot handle(unexpected question or response from representative) use in-context-learning(deducing answers from available data and logical deductions based on the conversation's context to formulate responses), and at last if nothing works say “I don’t understand”.

Closing the Call:
If all necessary information has been obtained, or if it becomes clear that no further information can be obtained at this time, conclude the call politely by thanking the representative and asking for their name and call reference number. If the call encounters ambiguity, unresolved issues, or becomes unproductive, acknowledge this respectfully and inform the representative that you will follow up if necessary.
Before ending the call, compile and provide a complete status update of the provider's application, ensuring that all pertinent details obtained during the call are included. This should be done without summarizing, truncating, or omitting any information.
In both scenarios, use the following JSON format to signal that it's time to end the conversation, ensuring to include both the standard end-call content and the comprehensive application status:
For a standard call conclusion:
{
  "responseType": "endCall",
  "content": "Thank you for the information and your time. We have covered all necessary points.",
  "applicationStatus": "Complete status update of the provider's application as obtained during the call."
}
For a call with unresolved issues or ambiguity:
{
  "responseType": "endCall",
  "content": "Unfortunately, we could not resolve all issues at this time. I will gather more information and reach back out if needed. Thank you for your assistance.",
  "applicationStatus": "Partial or unclear status update of the provider's application as understood during the call."
}


`;

export const USER_PROMPT_SCRIPTS = {
  CALL_RECORDING_1: [
    "Thank you for calling Emendi provider services. If you are a prescriber calling to initiate a prior authorization for a medication, please contact Magellan at 1877-309-9493. That number again is 1877-309-9493. This call may be monitored or recorded for quality purposes. Please have your MPI number available and select one of the four options for claims, billing, remittance form orders, and prior approval questions. Press option one for new enrollment into the New York State Medicaid program, including access to the new provider enrollment portal, assistance with EmedneID or Okta EVV attestation, ePACES enrollment, Eton applications, and provider maintenance forms. Press option two for explanation of eligibility responses. Press option three for PTAR support. Press option four. This call may be monitored or recorded for quality purposes. Please have your MPI number available and select one of the four options for claims, billing, remittance form orders, and prior approval questions.",
    "Press option one for new enrollment into the New York State Medicaid program. Include for ePACES enrollment and eTEN inquiries. Press option one. For all other enrollment inquiries, press option two. This call may be monitored or recorded for quality purposes. Please have your MPI number available and select one of the four options for claims, billing, remittance form orders, and prior approval questions",
    "Press option one for new enrollment into the New York State Medicaid program, including access to the new provider enrollment. For ePACES enrollment and eTEN inquiries, press option one. For all other enrollment inquiries, press option two.",
    "Hi, thanks for calling Emanue provider services. My name is Chandani. To better assist you, can I please have your first name?",
    "Can you please confirm the spelling, please?",
    "And the phone number, please?",
    "Is this for a new enrollment?",
    "Yes. How can I assist you today?",
    "It's in process. It's on day 35. Okay. It's still in process.",
    "So you do not require any other information? Right?",
    "Chandanicheandanichandani",
    "You're welcome. Was there anything else I could assist you with today?",
    "Have a good rest of your day, if nothing else.",
  ],
  CALL_RECORDING_6: [
    "Thank you for calling credentialing customer service. This customer service line is dedicated to provide status on your credentialing application, joining or remaining in Aetna's network only. All claim related questions cannot be answered and should be directed to the provider service center at 888-632-3862. Your call will be monitored and recorded for quality assurance purposes. If you are a provider and are interested in joining Aetna's network, please press or say one.",
    "If you are a provider and are calling about making updates to your demographic information, to obtain our mailing address, press one. If you have questions pertaining to credentialing or recredentialing, please remain on the line and a customer service representative will be with you shortly.",
    "Thanks for calling Edna Credentialing my name is Tracy and I'll be your customer service advocate for today to better assist you. Can I have your name please?",
    "what's your name?",
    "Can you spell that for me please?",
    "Phone number please?",
    "how may I help you today?",
    "Can I have the NPI of the provider please?",
    "When did you send the application and how did you submit the application?",
    "Do you have any request id?",
    "tax id ps",
    "First and last name of the provider.",
    "From what state are you calling in for this provider?",
    "And as per checking, here's for checking here, the application has been canceled for the reason that they are closing. For the application reviewed by local market and advice, no contracting at this time.",
    "So basically, we don't have any available contract for the provider as of this moment. So if you wish to reapply, you can reapply again.",
    "You want me to check another one?",
  ],
};
