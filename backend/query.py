import os
from langchain_ollama import ChatOllama
from langchain.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.retrievers.multi_query import MultiQueryRetriever
from get_vector_db import get_vector_db

LLM_MODEL = os.getenv('LLM_MODEL', 'gemma3')

def get_prompt():
    QUERY_PROMPT = PromptTemplate(
        input_variables=["question"],
        template="""You are an AI language model assistant. Your task is to generate five
        different versions of the given user question to retrieve relevant documents from
        a vector database. By generating multiple perspectives on the user question, your
        goal is to help the user overcome some of the limitations of the distance-based
        similarity search. Provide these alternative questions separated by newlines.
        Original question: {question}""",
    )

    template = """Answer the question based ONLY on the following context:
    {context}
    Question: {question}
    """

    prompt = ChatPromptTemplate.from_template(template)

    return QUERY_PROMPT, prompt

def query(input):
    try:
        if not input:
            return None
            
        # Create the LLM
        llm = ChatOllama(model=LLM_MODEL)
        
        # Direct approach - pass the complete prompt directly to the model
        # This ensures all style guidance and instructions are preserved
        chain = llm | StrOutputParser()
        
        # Execute the chain with the complete input
        response = chain.invoke(input)
        return response
    
    except Exception as e:
        print(f"Error in query function: {e}")
        # Final fallback
        return f"Error generating response: {str(e)}"